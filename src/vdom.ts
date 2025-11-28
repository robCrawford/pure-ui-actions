import {
  init,
  h,
  classModule,
  attributesModule,
  propsModule,
  eventListenersModule
} from "snabbdom";
import hyperscriptHelpers from "hyperscript-helpers";
import type { VNode, Hooks } from "snabbdom";
import { thunk } from "snabbdom";
export type { VNode };
export { thunk, thunk as memo };

export const patch = init([classModule, attributesModule, propsModule, eventListenersModule]);

export const html = hyperscriptHelpers(h);

export function setHook(vnode: VNode, hookName: keyof Hooks, callback: () => void): void {
  // See https://github.com/snabbdom/snabbdom#hooks
  if (vnode) {
    vnode.data = vnode.data || {};
    vnode.data.hook = vnode.data.hook || {};
    vnode.data.hook[hookName] = callback;
  }
}
