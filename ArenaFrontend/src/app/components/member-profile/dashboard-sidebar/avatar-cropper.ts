import { Component, input, output, signal } from '@angular/core';

/**
 * Lightweight, dependency-free avatar cropper. Shows the uploaded image inside
 * a circular frame; the user drags to reposition and zooms with a slider, then
 * the visible circle is rasterised to a square JPEG data URL.
 */
@Component({
  selector: 'app-avatar-cropper',
  standalone: true,
  template: `
    <div class="ac-overlay" (click)="cancel.emit()">
      <div class="ac-modal" (click)="$event.stopPropagation()">
        <h3 class="ac-title">Adjust your photo</h3>
        <p class="ac-hint">Drag to reposition · use the slider to zoom</p>

        <div
          class="ac-stage"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerup)="up($event)"
          (pointercancel)="up($event)"
          (pointerleave)="up($event)"
        >
          <img
            class="ac-img"
            [src]="src()"
            draggable="false"
            [style.width.px]="imgW()"
            [style.height.px]="imgH()"
            [style.left.px]="tx()"
            [style.top.px]="ty()"
            (load)="onLoad($event)"
          />
          <div class="ac-ring"></div>
        </div>

        <div class="ac-zoom">
          <span class="ac-zoom-i">–</span>
          <input type="range" min="1" max="3" step="0.01" [value]="zoom()" (input)="setZoom($event)" />
          <span class="ac-zoom-i">+</span>
        </div>

        <div class="ac-actions">
          <button type="button" class="ac-btn ac-cancel" (click)="cancel.emit()">Cancel</button>
          <button type="button" class="ac-btn ac-save" (click)="save()">Save photo</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ac-overlay {
      position: fixed; inset: 0; z-index: 2000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(8, 10, 16, 0.6);
      -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
      padding: 20px;
    }
    .ac-modal {
      width: 320px; max-width: 100%;
      background: #ffffff;
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      font-family: 'inter', system-ui, sans-serif;
    }
    :host-context([data-theme="dark"]) .ac-modal {
      background: #131722; color: #f1f5f9;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.06);
    }
    .ac-title { margin: 0; font-size: 16px; font-weight: 800; color: #1a1a1a; }
    :host-context([data-theme="dark"]) .ac-title { color: #f1f5f9; }
    .ac-hint { margin: 4px 0 16px; font-size: 12px; color: #6b7280; }

    .ac-stage {
      position: relative;
      width: 260px; height: 260px;
      margin: 0 auto;
      border-radius: 12px;
      overflow: hidden;
      background: #0c0f17;
      touch-action: none;
      cursor: grab;
    }
    .ac-stage:active { cursor: grabbing; }
    .ac-img { position: absolute; user-select: none; -webkit-user-drag: none; }
    .ac-ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 9999px rgba(8, 10, 16, 0.55);
      border: 2px solid rgba(255, 255, 255, 0.9);
      pointer-events: none;
    }

    .ac-zoom { display: flex; align-items: center; gap: 10px; margin: 16px 2px 4px; }
    .ac-zoom-i { font-size: 16px; font-weight: 800; color: #9ca3af; width: 12px; text-align: center; }
    .ac-zoom input { flex: 1; accent-color: #aed81f; cursor: pointer; }

    .ac-actions { display: flex; gap: 10px; margin-top: 16px; }
    .ac-btn {
      flex: 1; padding: 10px 14px; border-radius: 10px; border: none;
      font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit;
      transition: background 0.2s ease, transform 0.15s ease;
    }
    .ac-btn:hover { transform: translateY(-1px); }
    .ac-cancel { background: rgba(12, 15, 23, 0.06); color: #1a1a1a; }
    :host-context([data-theme="dark"]) .ac-cancel { background: rgba(255,255,255,0.08); color: #f1f5f9; }
    .ac-save { background: #C6EF2E; color: #0c0f17; }
    .ac-save:hover { background: #b8e018; }
  `],
})
export class AvatarCropperComponent {
  readonly src = input.required<string>();
  readonly cropped = output<string>();
  readonly cancel = output<void>();

  private readonly STAGE = 260;
  private readonly OUTPUT = 256;

  private nw = 0;
  private nh = 0;
  private base = 1;

  protected readonly zoom = signal(1);
  protected readonly tx = signal(0);
  protected readonly ty = signal(0);

  protected imgW(): number { return this.nw * this.base * this.zoom(); }
  protected imgH(): number { return this.nh * this.base * this.zoom(); }

  private dragging = false;
  private startX = 0;
  private startY = 0;
  private startTx = 0;
  private startTy = 0;

  protected onLoad(e: Event): void {
    const im = e.target as HTMLImageElement;
    this.nw = im.naturalWidth || 1;
    this.nh = im.naturalHeight || 1;
    this.base = Math.max(this.STAGE / this.nw, this.STAGE / this.nh);
    this.zoom.set(1);
    this.center();
  }

  private center(): void {
    this.tx.set((this.STAGE - this.imgW()) / 2);
    this.ty.set((this.STAGE - this.imgH()) / 2);
  }

  private clampX(x: number): number { return Math.min(0, Math.max(this.STAGE - this.imgW(), x)); }
  private clampY(y: number): number { return Math.min(0, Math.max(this.STAGE - this.imgH(), y)); }

  protected down(e: PointerEvent): void {
    this.dragging = true;
    this.startX = e.clientX; this.startY = e.clientY;
    this.startTx = this.tx(); this.startTy = this.ty();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  protected move(e: PointerEvent): void {
    if (!this.dragging) return;
    this.tx.set(this.clampX(this.startTx + (e.clientX - this.startX)));
    this.ty.set(this.clampY(this.startTy + (e.clientY - this.startY)));
  }

  protected up(_e: PointerEvent): void { this.dragging = false; }

  protected setZoom(e: Event): void {
    const z = parseFloat((e.target as HTMLInputElement).value);
    const c = this.STAGE / 2;
    const prevW = this.imgW(), prevH = this.imgH();
    this.zoom.set(z);
    // Keep the image point under the stage centre anchored while zooming.
    this.tx.set(this.clampX((this.tx() - c) * (this.imgW() / prevW) + c));
    this.ty.set(this.clampY((this.ty() - c) * (this.imgH() / prevH) + c));
  }

  protected save(): void {
    const total = this.base * this.zoom();
    const sx = (-this.tx()) / total;
    const sy = (-this.ty()) / total;
    const sSize = this.STAGE / total;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = this.OUTPUT;
      canvas.height = this.OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, this.OUTPUT, this.OUTPUT);
      this.cropped.emit(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = this.src();
  }
}
