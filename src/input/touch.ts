import { HERO, TARGET } from '../simulation/config.ts';
import type { Point } from '../simulation/movement.ts';

export type Action = 'attack' | 'q' | 'e' | 'r';
export type Aim = { action: Action; direction: Point; distance: number; canceled: boolean };
export const range = (action: Action) => action === 'r' ? HERO.r.distance : HERO[action].range;

/** Screen-relative input, using the same fixed camera basis as the keyboard. */
export function stick(dx: number, dy: number, radius: number, deadZone = 0.18): Point {
  const length = Math.hypot(dx, dy);
  if (length <= radius * deadZone) return { x: 0, z: 0 };
  const strength = Math.min(1, (length / radius - deadZone) / (1 - deadZone));
  const scale = strength / (length * Math.hypot(30, 46));
  return { x: (30 * dx + 46 * dy) * scale, z: (46 * dx - 30 * dy) * scale };
}

export function quickAim(action: Action, hero: Point, facing: Point): Aim {
  const dx = TARGET.spawn.x - hero.x, dz = TARGET.spawn.z - hero.z;
  const distance = Math.hypot(dx, dz), reach = range(action);
  const target = distance > 0 && distance <= reach;
  return { action, direction: target ? { x: dx / distance, z: dz / distance } : { ...facing },
    distance: target ? distance : reach, canceled: false };
}

export function setupTouch(
  joystick: HTMLElement, knob: HTMLElement, buttons: Record<Action, HTMLElement>, cancel: HTMLElement,
  hero: () => Point, onCast: (aim: Aim) => void, onSuspend: () => void,
  host: Window = window, page: Document = document,
) {
  let left: { id: number; x: number; y: number; radius: number } | undefined;
  let right: { id: number; x: number; y: number; action: Action; element: HTMLElement; dragged: boolean } | undefined;
  let movement: Point = { x: 0, z: 0 };
  let facing: Point = { x: -46 / Math.hypot(30, 46), z: 30 / Math.hypot(30, 46) };
  let aim: Aim | undefined;
  const listeners: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, callback: (event: any) => void) => {
    target.addEventListener(type, callback, { passive: false });
    listeners.push(() => target.removeEventListener(type, callback));
  };
  const release = (element: HTMLElement, id: number) => {
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
  const endLeft = () => {
    const old = left; left = undefined; movement = { x: 0, z: 0 };
    knob.style.transform = ''; if (old) release(joystick, old.id);
  };
  const endRight = () => {
    const old = right; right = undefined; aim = undefined; cancel.hidden = true;
    if (old) { old.element.classList.remove('active'); release(old.element, old.id); }
  };
  const reset = () => { endLeft(); endRight(); onSuspend(); };
  const moveLeft = (event: PointerEvent) => {
    if (!left || left.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - left.x, dy = event.clientY - left.y;
    movement = stick(dx, dy, left.radius);
    const scale = Math.min(1, left.radius / (Math.hypot(dx, dy) || 1));
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  };
  listen(joystick, 'pointerdown', (event: PointerEvent) => {
    if (left || event.button !== 0 || right?.id === event.pointerId) return;
    event.preventDefault();
    const rect = joystick.getBoundingClientRect();
    left = { id: event.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * 0.32 };
    joystick.setPointerCapture(event.pointerId); moveLeft(event);
  });
  listen(joystick, 'pointermove', moveLeft);
  listen(joystick, 'pointerup', (event: PointerEvent) => { if (left?.id === event.pointerId) endLeft(); });
  listen(joystick, 'lostpointercapture', (event: PointerEvent) => { if (left?.id === event.pointerId) reset(); });
  const moveRight = (event: PointerEvent) => {
    if (!right || right.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - right.x, dy = event.clientY - right.y;
    const length = Math.hypot(dx, dy);
    right.dragged ||= length > 10;
    const rect = cancel.getBoundingClientRect();
    const canceled = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (right.dragged && length > 0) {
      const direction = stick(dx, dy, 1, 0);
      aim = { action: right.action, direction, distance: range(right.action) * Math.min(1, length / 64), canceled };
    } else aim = { ...quickAim(right.action, hero(), facing), canceled };
    cancel.classList.toggle('active', canceled);
  };
  for (const action of Object.keys(buttons) as Action[]) {
    const element = buttons[action];
    listen(element, 'pointerdown', (event: PointerEvent) => {
      if (right || event.button !== 0 || left?.id === event.pointerId) return;
      event.preventDefault();
      right = { id: event.pointerId, x: event.clientX, y: event.clientY, action, element, dragged: false };
      aim = quickAim(action, hero(), facing); cancel.hidden = false; cancel.classList.remove('active');
      element.classList.add('active'); element.setPointerCapture(event.pointerId);
    });
    listen(element, 'pointermove', moveRight);
    listen(element, 'pointerup', (event: PointerEvent) => {
      if (right?.id !== event.pointerId) return;
      moveRight(event);
      const cast = aim; endRight(); if (cast && !cast.canceled) onCast(cast);
    });
    listen(element, 'lostpointercapture', (event: PointerEvent) => { if (right?.id === event.pointerId) reset(); });
  }
  listen(host, 'pointercancel', reset);
  listen(host, 'blur', reset); listen(host, 'orientationchange', reset); listen(host, 'resize', reset);
  listen(page, 'visibilitychange', reset);
  listen(page, 'focusin', reset);
  return {
    read: () => ({ ...movement }),
    aiming() {
      if (right && !right.dragged && aim) aim = { ...quickAim(right.action, hero(), facing), canceled: aim.canceled };
      return aim;
    },
    face(input: Point) { const length = Math.hypot(input.x, input.z); if (length > 0) facing = { x: input.x / length, z: input.z / length }; },
    reset,
    dispose() { reset(); for (const remove of listeners) remove(); },
  };
}
