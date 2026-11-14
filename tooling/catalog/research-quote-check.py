"""Offline checks of the saved originals and their hash-bound research extracts.

No source documents are copied. Visual transcriptions retain that weaker method;
this script does not claim to repeat the research's visual review.
"""
import hashlib
import json
from pathlib import Path
import sys
import unicodedata
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def squash(text):
    return ' '.join(unicodedata.normalize('NFKC', text).split())


request = json.load(sys.stdin)
checked = {}
texts = {}
manual = {}
for kind, root in request['roots'].items():
    root = Path(root)
    sources = request['sources'][kind]
    for s in sources:
        data = (root / s['savedFile']).read_bytes()
        if sha(data) != s['sha256']:
            raise ValueError('SOURCE_HASH_MISMATCH ' + kind + ':' + s['id'])
        checked[kind + ':' + s['id']] = len(data)
        artifacts = s.get('derivedFiles', []) + s.get('derivedArtifacts', [])
        if s.get('textFile'):
            artifacts.append({'savedFile': s['textFile'], 'sha256': s['textSha256']})
        for a in artifacts:
            raw = (root / a['savedFile']).read_bytes()
            if sha(raw) != a['sha256']:
                raise ValueError('TEXT_HASH_MISMATCH ' + a['savedFile'])
            texts[kind + ':' + a['savedFile']] = raw.decode('utf8') if a['savedFile'].endswith(('.txt', '.csv')) else ''
    if kind == 'income':
        path = root / '.research-sources/2026-11-10/manual-quote-transcriptions.json'
        # The research snapshot manifest binds the visual transcription bytes.
        manifest = request['incomeManifest']
        target = next(a for a in manifest['files'] if a['savedFile'] == str(path.relative_to(root)))
        raw = path.read_bytes()
        if sha(raw) != target['sha256']:
            raise ValueError('MANUAL_HASH_MISMATCH')
        manual[kind] = json.loads(raw)

# Check native CSV quotations against exact lines in the ORIGINAL zip member.
zip_lines = {}
for kind in request['roots']:
    for s in request['sources'][kind]:
        wanted = [q for q in request['quotes'] if q['kind'] == kind and q['researchSourceId'] == s['id'] and q['locator'].get('csvLineNumber')]
        if not wanted:
            continue
        by_line = {q['locator']['csvLineNumber']: q for q in wanted}
        with zipfile.ZipFile(Path(request['roots'][kind]) / s['savedFile']) as archive:
            member = wanted[0]['locator']['archiveMember']
            last_line = max(by_line)
            with archive.open(member) as stream:
                for line_no, line in enumerate(stream, 1):
                    if line_no in by_line:
                        zip_lines[(kind, s['id'], line_no)] = line.decode('utf-8-sig').rstrip('\r\n')
                    if line_no >= last_line:
                        break


def originals(value):
    if isinstance(value, list):
        return [v for x in value for v in originals(x)]
    if isinstance(value, dict):
        return ([value['original']] if 'original' in value else []) + [v for x in value.values() if isinstance(x, (dict, list)) for v in originals(x)]
    return []


results = []
for q in request['quotes']:
    kind = q['kind']
    s = next(s for s in request['sources'][kind] if s['id'] == q['researchSourceId'])
    loc = q['locator']
    method = 'hash_bound_research_text'
    artifact = q.get('textFile') or s.get('textFile')
    if loc.get('csvLineNumber'):
        text = zip_lines[(kind, s['id'], loc['csvLineNumber'])]
        matched = text == q['quote']
        method = 'literal_original_archive_row'
        artifact = s['savedFile']
    else:
        text = texts.get(kind + ':' + str(artifact), '')
        if q.get('textSha256') and sha((Path(request['roots'][kind]) / artifact).read_bytes()) != q['textSha256']:
            raise ValueError('QUOTE_TEXT_HASH_MISMATCH')
        if not q.get('textFile') and s['savedFile'].endswith('.pdf') and loc.get('pdfPage'):
            text = text.split('\f')[loc['pdfPage'] - 1]
        matched = squash(q['quote']) in squash(text)
        if not matched and kind == 'income':
            candidates = [m for m in manual[kind] if m['sourceId'] == s['id']]
            matched = any(squash(q['quote']) == squash(v) for v in originals(candidates))
            if matched:
                method = 'research_visual_transcription'
                artifact = '.research-sources/2026-11-10/manual-quote-transcriptions.json'
    if not matched:
        raise ValueError('QUOTE_NOT_FOUND ' + q['where'] + ' ' + q['quote'][:100])
    results.append({**q, 'matched': True, 'method': method, 'artifact': artifact})
json.dump({'sources': checked, 'checks': results}, sys.stdout, ensure_ascii=False)
