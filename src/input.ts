export type Action = "toggleWeapon" | "attack" | "skill1" | "skill2" | "dodge" | "jump" | "interact" | "ping" | "mount";
export type Shortcut = "map" | "journal" | "escape";
export const KEY_ACTIONS: Readonly<Record<string, Action>> = {
  Space: "jump", KeyQ: "dodge", KeyJ: "attack", KeyK: "skill1", KeyL: "skill2",
  KeyX: "toggleWeapon", Digit1: "skill1", Digit2: "skill2", KeyE: "interact", KeyF: "ping", KeyB: "mount",
};
const SHORTCUTS: Record<string, Shortcut> = { KeyM: "map", KeyI: "journal", Escape: "escape" };
const HELD_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "KeyR", "KeyC"]);
export class Controls {
  move = { x: 0, y: 0 };
  look = { x: 0, y: 0 };
  actions: Action[] = [];
  keys = new Set<string>();
  enabled = false;
  sensitivity = 1;
  onResetLook: () => void = () => {};
  mode: "keyboard" | "touch" = "keyboard";
  onShortcut: (shortcut: Shortcut) => void = () => {};
  onZoom: (delta: number) => void = () => {};
  private bound = false;
  private sprintToggle = false;
  private liftPointers = new Map<number, number>();
  private captures = new Map<number, HTMLElement>();
  private stickId: number | null = null;
  private lookId: number | null = null;
  private origin = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private abort = new AbortController();
  private lockPending = false;
  private lockExitAt = 0;
  private mouseSurface: HTMLElement | null = null;
  private releaseMouse = () => {
    if (document.pointerLockElement === this.mouseSurface && this.mouseSurface) document.exitPointerLock();
    this.lockPending = false;
    this.reset();
  };
  private requestMouse() {
    if (!this.enabled || this.panelOpen() || this.lockPending || !this.mouseSurface) return;
    this.reset(); this.lockPending = true;
    try {
      const result = this.mouseSurface.requestPointerLock();
      result?.catch(() => this.lockFailed());
    } catch { this.lockFailed(); }
  }
  private lockFailed() {
    this.releaseMouse();
    const button = document.querySelector<HTMLButtonElement>('#mouse-control');
    if (button) { button.textContent = '鼠标视角未启用 · 可右键拖动'; button.title = '点击重试；也可按住右键拖动视角'; }
  }
  constructor() {
    const signal = this.abort.signal;
    this.setMode(matchMedia("(any-pointer: fine)").matches || !matchMedia("(pointer: coarse)").matches ? "keyboard" : "touch");
    window.addEventListener("keydown", e => {
      // Preserve browser shortcuts, editing and native button activation.
      if (e.metaKey || e.ctrlKey || e.altKey || /^(Meta|Alt|Control)/.test(e.code)) { this.reset(); return; }
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') && e.code !== "Escape") return;
      if (SHORTCUTS[e.code]) {
        if (e.code === 'Escape' && (document.pointerLockElement || performance.now() - this.lockExitAt < 250)) {
          this.releaseMouse(); e.preventDefault(); return;
        }
        if (!e.repeat) { this.setMode("keyboard"); this.reset(); this.onShortcut(SHORTCUTS[e.code]); }
        e.preventDefault(); return;
      }
      if (!this.enabled || this.panelOpen()) return;
      if (target?.closest('button,a,summary,[role="button"]') && ["Space", "Enter"].includes(e.code)) return;
      if (!HELD_KEYS.has(e.code) && !KEY_ACTIONS[e.code]) return;
      this.setMode("keyboard"); e.preventDefault();
      if (HELD_KEYS.has(e.code)) this.keys.add(e.code);
      if (!e.repeat && KEY_ACTIONS[e.code]) this.actions.push(KEY_ACTIONS[e.code]);
    }, { signal });
    window.addEventListener("keyup", e => this.keys.delete(e.code), { signal });
    window.addEventListener("blur", this.releaseMouse, { signal });
    window.addEventListener("pagehide", this.releaseMouse, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.releaseMouse(); }, { signal });
    document.addEventListener("fullscreenchange", this.releaseMouse, { signal });
    document.addEventListener("goulai-input-block", () => { this.enabled = false; this.releaseMouse(); }, { signal });
    document.addEventListener('pointerlockerror', () => this.lockFailed(), { signal });
    document.addEventListener('pointerlockchange', () => {
      this.lockPending = false; this.reset();
      const locked = !!this.mouseSurface && document.pointerLockElement === this.mouseSurface;
      document.body.classList.toggle('mouse-locked', locked);
      if (!locked) this.lockExitAt = performance.now();
      if (locked && (!this.enabled || this.panelOpen())) this.releaseMouse();
      const button = document.querySelector<HTMLButtonElement>('#mouse-control');
      if (button) button.textContent = locked ? 'Esc 释放鼠标' : '进入鼠标视角';
    }, { signal });
    document.addEventListener('mousemove', e => {
      if (!this.mouseSurface || document.pointerLockElement !== this.mouseSurface) return;
      if (!this.enabled || this.panelOpen()) { this.releaseMouse(); return; }
      this.look.x += Math.max(-200, Math.min(200, e.movementX)) * .0022 * this.sensitivity;
      this.look.y += Math.max(-200, Math.min(200, e.movementY)) * .0022 * this.sensitivity;
    }, { signal });
    document.addEventListener("pointerdown", e => this.setMode(e.pointerType === "mouse" ? "keyboard" : "touch"), { signal, capture: true });
    document.addEventListener("focusin", e => {
      if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]')) this.releaseMouse();
    }, { signal });
    window.addEventListener("pointerup", e => this.end(e.pointerId), { signal });
    window.addEventListener("pointercancel", this.releaseMouse, { signal });
  }
  private setMode(mode: "keyboard" | "touch") {
    this.mode = mode;
    document.body.classList.toggle("keyboard-input", mode === "keyboard");
    document.body.classList.toggle("touch-input", mode === "touch");
  }
  private panelOpen() {
    return !!document.querySelector('#modal-layer:not([hidden]),#story-reader:not([hidden]),#dialogue:not([hidden])');
  }
  private capture(el: HTMLElement, id: number) { this.captures.set(id, el); el.setPointerCapture(id); }
  bind() {
    if (this.bound) return;
    this.bound = true;
    const stick = document.querySelector<HTMLElement>("#joystick")!, knob = document.querySelector<HTMLElement>("#knob")!, look = document.querySelector<HTMLElement>("#look-zone")!;
    const signal = this.abort.signal;
    look.tabIndex = -1;
    this.mouseSurface = look;
    const mouseButton = document.createElement('button');
    mouseButton.id = 'mouse-control'; mouseButton.textContent = '进入鼠标视角';
    mouseButton.title = '移动鼠标转视角，Esc 释放；右键拖动可备用';
    document.querySelector('#hud')?.append(mouseButton);
    mouseButton.addEventListener('click', () => this.requestMouse(), { signal });
    for (const el of [stick, look]) el.addEventListener("lostpointercapture", e => this.end(e.pointerId), { signal });
    stick.addEventListener("pointerdown", e => {
      if (!this.enabled || this.panelOpen() || this.stickId !== null || e.button !== 0) return;
      e.preventDefault(); this.stickId = e.pointerId;
      const r = stick.getBoundingClientRect(); this.origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.capture(stick, e.pointerId); this.stickMove(e, knob);
    }, { signal });
    stick.addEventListener("pointermove", e => { if (e.pointerId === this.stickId) this.stickMove(e, knob); }, { signal });
    look.addEventListener("pointerdown", e => {
      if (!this.enabled || this.panelOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      look.focus({ preventScroll: true });
      if (e.pointerType === "mouse" && e.button === 0) {
        if (document.pointerLockElement === look) this.actions.push("attack");
        else this.requestMouse();
        e.preventDefault(); return;
      }
      if (document.pointerLockElement === look) return;
      if (e.pointerType === "mouse" && e.button !== 2 || this.lookId !== null) return;
      e.preventDefault(); this.lookId = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY }; this.capture(look, e.pointerId);
    }, { signal });
    look.addEventListener("pointermove", e => {
      if (e.pointerId !== this.lookId) return;
      if (e.pointerType === "mouse" && !(e.buttons & 2)) { this.end(e.pointerId); return; }
      const gain=e.pointerType==='mouse'?.0022*this.sensitivity:.005;
      this.look.x += (e.clientX - this.last.x) * gain; this.look.y += (e.clientY - this.last.y) * gain;
      this.last = { x: e.clientX, y: e.clientY };
    }, { signal });
    look.addEventListener("contextmenu", e => { if (this.enabled && !this.panelOpen()) e.preventDefault(); }, { signal });
    look.addEventListener("wheel", e => {
      if (!this.enabled || this.panelOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); this.onZoom(Math.max(-180, Math.min(180, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1))));
    }, { signal, passive: false });
    document.querySelector<HTMLElement>("[data-sprint]")?.addEventListener("pointerdown", e => {
      e.preventDefault(); if (this.enabled && !this.panelOpen()) { this.sprintToggle = !this.sprintToggle; this.updateSprintButton(); }
    }, { signal });
    document.querySelectorAll<HTMLElement>("[data-lift]").forEach(el => {
      el.addEventListener("pointerdown", e => {
        e.preventDefault(); if (!this.enabled || this.panelOpen() || e.button !== 0) return;
        this.liftPointers.set(e.pointerId, Number(el.dataset.lift)); this.capture(el, e.pointerId); el.classList.add("held");
      }, { signal });
      el.addEventListener("lostpointercapture", e => this.end(e.pointerId), { signal });
    });
    document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(el => {
      const activate = () => { if (this.enabled && !this.panelOpen() && !el.disabled && el.getAttribute("aria-disabled") !== "true") this.actions.push(el.dataset.action as Action); };
      el.addEventListener("pointerdown", e => { if (e.button === 0) { e.preventDefault(); activate(); } }, { signal });
      el.addEventListener("click", e => { if (e.detail === 0) activate(); }, { signal });
    });
  }
  private stickMove(e: PointerEvent, knob: HTMLElement) {
    const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y, len = Math.hypot(dx, dy), r = 44;
    this.move = { x: dx / Math.max(r, len), y: -dy / Math.max(r, len) };
    knob.style.transform = "translate(" + this.move.x * r + "px," + -this.move.y * r + "px)";
  }
  private end(id: number) {
    this.liftPointers.delete(id);
    const captured = this.captures.get(id); this.captures.delete(id);
    captured?.classList.remove("held");
    if (captured?.hasPointerCapture(id)) captured.releasePointerCapture(id);
    if (id === this.stickId) {
      this.stickId = null; this.move = { x: 0, y: 0 }; this.sprintToggle = false; this.updateSprintButton();
      const knob = document.querySelector<HTMLElement>("#knob"); if (knob) knob.style.transform = "";
    }
    if (id === this.lookId) this.lookId = null;
  }
  read(yaw: number) {
    let x = this.move.x, y = this.move.y;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (Math.hypot(x, y) < .08 && this.sprintToggle) { this.sprintToggle = false; this.updateSprintButton(); }
    const l = Math.max(1, Math.hypot(x, y));
    return {
      x: (x * Math.cos(yaw) + y * Math.sin(yaw)) / l, z: (y * Math.cos(yaw) - x * Math.sin(yaw)) / l,
      actions: this.actions.splice(0),
      lift: Math.max(-1, Math.min(1, (this.keys.has("KeyR") ? 1 : 0) - (this.keys.has("KeyC") ? 1 : 0) + [...this.liftPointers.values()].reduce((a, b) => a + b, 0))),
      sprint: Math.hypot(x, y) > .08 && (this.sprintToggle || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")),
    };
  }
  private updateSprintButton() {
    const button = document.querySelector<HTMLElement>("[data-sprint]");
    button?.classList.toggle("active", this.sprintToggle); button?.setAttribute("aria-pressed", String(this.sprintToggle));
  }
  reset() {
    this.onResetLook();
    this.keys.clear(); for (const id of this.captures.keys()) this.end(id);
    this.liftPointers.clear(); this.sprintToggle = false; this.updateSprintButton();
    this.look = { x: 0, y: 0 }; this.move = { x: 0, y: 0 }; this.actions = []; this.stickId = this.lookId = null;
  }
  dispose() { this.releaseMouse(); this.abort.abort(); document.querySelector('#mouse-control')?.remove(); }
}
