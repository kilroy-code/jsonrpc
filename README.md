# jsonrpc

Easy setup jsonrpc using postMessage between frames or workers.

```
// In worker.js
import dispatch from "/@kilroy-code/jsonrpc/index.mjs";
const send = dispatch(self, self);
async function sum(a, b) { return a + b + await send('getOffset'); }

// In app.js
import dispatch from "@kilroy-code/jsonrpc/index.mjs";
const worker = new Worker('worker.mjs', {type: "module"});
const send = dispatch(worker, self);
function getOffset() { return 42; }
async function demo() { return await send('sum', 1, 2); }
```

The default export from this package is a function of two arguments -- `target` and `namespace` that does two things:

1. It adds a handler for `message` events on `target`. The handler processes jsonrpc requests or responses and ignores non-jsonprc messages. The `target` can be anything that defines `postMessage`, such as port, worker, the contentWindow for an iframe, or top-level self. When a jsonrpc request comes in from `target`, the handler will call `namespace[method](...params)` and send the result or error back to `target`.
2. Returns a `function(methodName, ...arguments)` that can be used to make requests to target. A call to this function returns a Promise that will be resolved or rejected with the response from target. (All such requests are sent as a jsonrpc request that expects a response, and not as jsonrpc 1.0 notifications which have no way to indicate errors.)

Although the above example shows @kilroy-code/jsonrpc being used on both sides, any jsonrpc conforming implementation can be used on the other side. Although @kilroy-code/jsonrpc always sends array params, it will accept a single object as params as well for compatability with other jsonrpc impelmentations.

If you are only concerned with requesting to target and receiving a response - i.e., if you are not expecting target to make a request to you - then you can leave off the `namespace` argument.


### Warning

Many implementations of `postMessage` do not accept a `targetOrigin` second argument, and indeed will produce an error if one is supplied. The current implementation does not attempt to supply a `targetOrigin` to _any_ `postMessage` calls. This may make it unsuitable for use within an iframe for sending messages to a parent frame on a different origin.

