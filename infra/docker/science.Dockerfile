FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159
ENV DEVELOPMENT=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY apps/science/requirements.lock.txt .
RUN pip install --no-cache-dir --default-timeout=300 --retries 8 -r requirements.lock.txt
COPY apps/science/service.py .
RUN python -c "import service"
USER nobody
EXPOSE 8090
CMD ["python", "service.py"]
