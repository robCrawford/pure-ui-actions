/*
A wrapper around `https://github.com/snabbdom/snabbdom`
with html functions from `https://github.com/ohanhi/hyperscript-helpers`
*/
import { init, h, classModule, attributesModule, propsModule, eventListenersModule } from "snabbdom";
import hyperscriptHelpers from 'hyperscript-helpers';
import type { VNode, Hooks } from "snabbdom";
import { thunk } from "snabbdom";
export type { VNode };
export { thunk, thunk as memo };

export const patch = init([ classModule, attributesModule, propsModule, eventListenersModule ]);

export const html = hyperscriptHelpers(h);

export function setHook(vnode: VNode, hookName: keyof Hooks, callback: () => void): void {
  // https://github.com/snabbdom/snabbdom#hooks
  // init        a vnode has been added                                vnode
  // create      a DOM element has been created based on a vnode       emptyVnode, vnode
  // insert      an element has been inserted into the DOM             vnode
  // prepatch    an element is about to be patched                     oldVnode, vnode
  // update      an element is being updated                           oldVnode, vnode
  // postpatch   an element has been patched                           oldVnode, vnode
  // destroy     an element is directly or indirectly being removed    vnode
  // remove      an element is directly being removed from the DOM     vnode, removeCallback
  if (vnode) {
    vnode.data = vnode.data || {};
    vnode.data.hook = vnode.data.hook || {};
    vnode.data.hook[hookName] = callback;
  }
}
