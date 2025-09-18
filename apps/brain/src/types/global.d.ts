// types/global.d.ts

declare class ImageCapture {
  constructor(videoTrack: MediaStreamTrack);
  grabFrame(): Promise<ImageBitmap>;
  getPhotoCapabilities(): Promise<any>;
  getPhotoSettings(): Promise<any>;
  takePhoto(photoSettings?: any): Promise<Blob>;
  readonly track: MediaStreamTrack;
}