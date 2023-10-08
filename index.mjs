
function transferrableError(error) { // An error object that we receive on our side will not be transferrable to the other.
  let {name, message} = error;
  return {name, message};
}

function dispatch(target, namespace) {
  let requests = {},
      messageId = 0,
      jsonrpc = '2.0';

  target.addEventListener('message', async event => {
    let {id, method, params, result, error, jsonrpc:version} = event.data || {};
    if (version !== jsonrpc) return console.log(`Ignoring non-jsonrpc message ${event.data}.`);

    if (method) { // Incoming request or notification from target.
      let error = null,
	  args = Array.isArray(params) ? params : [params], // Accept either form of params.
	  result = await namespace[method](...args).catch(e => error = transferrableError(e)),
	  response = error ? {id, error, jsonrpc} : {id, result, jsonrpc};
      return target.postMessage(response);
    }

    let request = requests[id]; // A response from target to a request that we made earlier.
    delete requests[id];
    if (!request) return console.log(`Ignoring response ${event.data}.`);
    if (error) request.reject(error);
    else request.resolve(result);
  });

  return function request(method, ...params) {
    let id = ++messageId,
	request = requests[id] = {};
    return new Promise((resolve, reject) => {
      Object.assign(request, {resolve, reject});
      target.postMessage({id, method, params, jsonrpc});
    });
  };
}

export default dispatch;
