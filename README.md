# jsonrpc

Easy setup two-way jsonrpc using postMessage between frames or workers.

```
// In worker.js
import dispatch from "/@kilroy-code/jsonrpc/index.mjs";
const send = dispatch({target: self);
async function sum(a, b) { return a + b + await send('getOffset'); }

// In app.js
import dispatch from "@kilroy-code/jsonrpc/index.mjs";
const worker = new Worker('worker.mjs', {type: "module"});
const send = dispatch({target: worker, receiver: self)};
function getOffset() { return 42; }
async function demo() { return await send('sum', 1, 2); }
```

The default export from this package is a
```
function({
   target,
   receiver = target,
   namespace = receiver,
   origin = ((target !== receiver) && target.location.origin),
   log = () => null,
   warn = console.warn.bind(console),
   error = console.error.bind(console)
})
```
that does two things:

1. It adds a handler for `message` events on `receiver`. The handler processes jsonrpc requests or responses and ignores non-jsonprc messages. The `target` can be anything that defines `postMessage`, such as port, worker, the contentWindow for an iframe, or top-level self. When a jsonrpc request comes in from `target`, the handler will call `namespace[method](...params)` and send the result or error back to `target`.
2. Returns a `function(methodName, ...arguments)` that can be used to make requests (and internal responses) to target. A call to this function returns a Promise that will be resolved or rejected with the response from target. (All such requests are sent as a jsonrpc request that expects a response, and not as jsonrpc 1.0 notifications which have no way to indicate errors.)

Although the above example shows @kilroy-code/jsonrpc being used on both sides, any jsonrpc conforming implementation can be used on the other side. Although @kilroy-code/jsonrpc always sends array params, it will accept a single object as params as well for compatability with other jsonrpc implementations.

The `origin` argument is used the second argument to `target.postMessage(message, targetOrigin)`, and is used in the `receiver.onmessage` handler to ignore messages that are not from the spected origin.

The `log`, `warn`, and `error` arguments are used to log sending/receiving, non-jsonrpc messages, and origin or source mismatches, respectively



