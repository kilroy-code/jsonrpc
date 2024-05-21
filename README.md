# jsonrpc

Easy setup, two-way [jsonrpc](https://www.jsonrpc.org/specification) using [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) between [frames](https://developer.mozilla.org/en-US/docs/Glossary/WindowProxy) or [workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker).

```
// In worker.js
import dispatch from '@ki1r0y/jsonrpc/index.mjs';
const send = dispatch({ target: self }); // Returns a function.
async function sum(a, b) {               // Callable by other end.
  let offset = await send('getOffset');  // Call getOffset() at other end, returning promise.
  return a + b + offset;
}

// In app.js
import dispatch from '@ki1r0y/jsonrpc/index.mjs';
const worker = new Worker('worker.mjs', {type: 'module'});
const send = dispatch({ target: worker, receiver: self })}; // Returns a function.
function getOffset() {               // Callable by other end.
  return 42;
}
async function demo() {
  return await send('sum', 1, 2);    // Calls sum(1, 2) at other end.
}
```

The default export from this package is a

```
function({
   target = self,
   receiver = target,
   namespace = receiver,
   origin = ((target !== receiver) && target.location.origin),

   log = null,
   info = console.info.bind(console),
   warn = console.warn.bind(console),
   error = console.error.bind(console),
      
   targetLabel = target.name || origin || target.location?.href || target,
   dispatherLabel = namespace.name || receiver.name || receiver.location?.href || receiver
})
```
that does two things:

1. It adds a handler for `message` events on `receiver`([*](#notes)). The handler processes jsonrpc requests or responses and ignores non-jsonprc messages. The `target` can be anything that defines `postMessage`, such as port, worker, the contentWindow for an iframe, or top-level self. When a jsonrpc request comes in from `target`, the handler will call `namespace[method](...params)` and send the result or error back to `target`.
2. Returns a `function(methodName, ...arguments)` that can be used to make requests to target. A call to this function returns a Promise that will be resolved or rejected with the response from target. (All such requests are sent as a jsonrpc request that expects a response, and not as jsonrpc 1.0 notifications which have no way to indicate errors.)

Although the above example shows @ki1r0y/jsonrpc being used on both sides, any [JSON-RPC 2.0](https://www.jsonrpc.org/specification) conforming implementation can be used on the other side. Although @ki1r0y/jsonrpc always sends array params, it will accept a single object as params as well for compatability with other jsonrpc implementations.

The `origin` argument is used the second argument to `target.postMessage(message, targetOrigin)`, and is used in the `receiver.onmessage` handler to ignore messages that are not from the spected origin.

The `log`, `info`, `warn`, and `error` arguments are used to log sending/receiving, setup, non-jsonrpc messages, and origin or source mismatches, respectively, using `targetLabel` and `dispatcherLabel`. A falsy value for a logger is allowed.

## Errors

When handling an incoming request, we call `namespace[method](...params)`, await the response, and post the jsonrpc `result` using the original request `id`. (See [spec](https://www.jsonrpc.org/specification).) If the call throws an error or is rejected, an `error` response is send back on the request `id`.

Error objects (or more generally thrown and rejected values) are not necessarily [transferable](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) by [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage). We transfer them as a [POJO](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) containing the properties `name`, `code`, `message`, and `data` from the rejection.

When receiving a request error response, the promise is rejected with this object as value.

## A Complex Example

The ki1r0y [distributed-security](https://github.com/kilroy-code/distributed-security) package implements a separate secure browsing context for cryptographic work. Applications load the module from an [origin](https://developer.mozilla.org/en-US/docs/Glossary/Origin) that is distinct from the rest of the application. The module then dynamically creates an iframe, which itself launches a web worker. This creates the following:

```
   app origin                  distributed-security origin
     foo.com                         security.foo.com
+--------------+         +--------------+         +-------------+
| application  |         | iframe       |         | worker      |
|.             | jsonrpc |              | jsonrpc |             |     
|            --+---------+->          --+---------+->           |
|  index.mjs <-+---------+- vault.mjs <-+---------+- worker.mjs |
+--------------+         +--------------+         +-------------+
```

On the right-hand side, the connection from worker.mjs is a straightforward two-direction jsonrpc to the vault.mjs code in in the iframe. [worker.mjs](https://github.com/kilroy-code/distributed-security/blob/main/lib/worker.mjs) imports the Security API and jsonrpc dispatch. Only a single line is needed to arrange for `postClient` to be a function that uses the worker's postMessage to send requests to vault.mjs, and to answer requests from vault.mjs by calling the named method in the Security api. 

(`targeLabel` helps jsonrpc emit clear and specific logging when there are multiple jsonrpc pathways. The worker knows it's own name, but does not know the name of the other end.)

The worker instance is specifically created by vault.mjs, so the other end of the connection in worker.mjs is unambigous. Within [vault.mjs](https://github.com/kilroy-code/distributed-security/blob/main/lib/vault.mjs), the `postWorker` definition at the bottom of the file is not much more complicated, needing only to additionally specify the worker object as the `target`.

Between index.mjs and vault.mjs, there are another pair of jsonrpc connections. In most cases, these could both be specified using the `origin` parameter to `dispatch`, which would arrange for messages to be sent only to the specified target, and noisily ignoring messages that are not from the specified target. However, in distributed-security, it is possible, and even encouraged, for multiple components of the application to separately include their own versions of distributed-security. The could all import the same index.mjs from security.foo.com (in this example app), in which case they all communicate with the same vault.  

However, they could also import their own *copies* of index.mjs hosted at different domains. That will also work just fine, with each vault only accessible by the code using the import.mjs loaded from that domain.

Although not correct production usage, the various components could all load copies from the same domain -- e.g., a developer's localhost. If the various components that reference index.mjs are each bundled into their own separate component module, then the different modules will create different vaults. Even this will correctly distinguish between communications to different vaults, but jsonrpc will log that it is rejecting messages from other modules. To be obsolutely clear that no cross-module communication is happening, distributed-security uses MessagePorts for communcation, which were created for this situation. In [index.mjs](https://github.com/kilroy-code/distributed-security/blob/main/index.mjs) and the postClient definition in [vault.mjs](https://github.com/kilroy-code/distributed-security/blob/main/lib/vault.mjs), we see these MessagePorts used as targets. The initialization of the vault.mjs message port from index.mjs is done in an additional message outside of the jsonrpc implementation.

---
### Notes

- The 'message' handler is added using `receiver.addEventListener`, and not `receiver.onmessage`. If the application creates a [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) and passes this as the `receiver`, the application must call [`start`](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/start) on the message port, as `addEventListener` does [not automatically do this](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/message_event) the way `onmessage` does.
