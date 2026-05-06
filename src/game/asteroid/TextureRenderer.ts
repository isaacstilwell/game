import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipMapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

class TextureRenderer {
  private isOffscreen: boolean;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private target: WebGLRenderTarget;
  private geometry: PlaneGeometry;
  private material: ShaderMaterial;
  private plane: Mesh;

  constructor() {
    this.isOffscreen = (typeof OffscreenCanvas !== 'undefined');

    let canvas: HTMLCanvasElement | OffscreenCanvas | undefined;
    if (this.isOffscreen) {
      canvas = new OffscreenCanvas(0, 0);
      (canvas as any).style = { width: 0, height: 0 };
    }

    this.renderer = new WebGLRenderer({ canvas: canvas as any, antialias: true });
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1000);
    this.target = new WebGLRenderTarget(1, 1, {
      minFilter: LinearMipMapLinearFilter,
      magFilter: LinearFilter,
    });
    this.geometry = new PlaneGeometry(2, 2);
    this.material = new ShaderMaterial();
    this.plane = new Mesh(this.geometry, this.material);
    this.plane.position.z = -10;
    this.scene.add(this.plane);
  }

  render(width: number, height: number, material: ShaderMaterial | MeshBasicMaterial): { buffer: Uint8Array; width: number; height: number; format: typeof RGBAFormat } {
    this.plane.material = material as any;
    this.target.setSize(width, height);
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    const buffer = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, width, height, buffer);
    return { buffer, width, height, format: RGBAFormat };
  }

  renderBitmap(width: number, height: number, material: ShaderMaterial | MeshBasicMaterial, dataTextureOptions: Record<string, any> = {}): DataTexture | ImageBitmap {
    // (transferToImageBitmap only supported in offscreencanvas, so here is workaround for "onscreen" canvas)
    if (!this.isOffscreen) {
      const map = this.render(width, height, material);
      const dataTexture = new DataTexture(map.buffer, map.width, map.height, map.format);
      dataTexture.flipY = true;
      dataTexture.generateMipmaps = true;
      dataTexture.minFilter = LinearMipMapLinearFilter;
      dataTexture.magFilter = LinearFilter;
      Object.keys(dataTextureOptions).forEach((k) => (dataTexture as any)[k] = dataTextureOptions[k]);
      dataTexture.needsUpdate = true;
      return dataTexture;
    }

    this.plane.material = material as any;
    this.renderer.setSize(width, height);
    (this.renderer.domElement as any).width = width;
    (this.renderer.domElement as any).height = height;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    return (this.renderer.domElement as unknown as OffscreenCanvas).transferToImageBitmap();
  }

  textureToDataBuffer(texture: any): Uint8Array | undefined {
    const pixels = this.render(
      texture.image?.width || 0,
      texture.image?.height || 0,
      new MeshBasicMaterial({ map: texture }) as any
    );
    return pixels?.buffer;
  }
}

export default TextureRenderer;
