// A crop-health failure with a stable code the API returns; never carries
// provider messages, photo content or credentials.
export class CropHealthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
