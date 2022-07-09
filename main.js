addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
})

const ORIGIN_ALLOWLIST = ["https://he1en.github.io"];

async function handleRequest(request) {
  if (!isAllowed(request)) {
    return new Response(
      null,
      {status: 403, statusText: 'Forbidden'}
    )
  }

  // full_url is https://corsproxy.he1en.workers.dev/?actual_url
  const full_url = new URL(request.url);
  const requested_url = decodeURIComponent(decodeURIComponent(full_url.search.substr(1)));
  // maybe return a bad response if url is misformatted

  // send proxied request
  var response = await sendRequest(request, requested_url);

  // make response headers CORS friendly and return
  const newHeaders = constructResponseHeaders(response.headers, request.headers);
  if (request.method === "OPTIONS") {
    // CORS preflight request
    const responseOpts = {headers: newHeaders, status: 200, statusText: "OK"};
    return new Response(null, responseOpts);
  } else {
    const responseBody = await response.arrayBuffer();
    const responseOpts = {headers: newHeaders, status: response.status, statusText: response.statusText};
    return new Response(responseBody, responseOpts);
  }
}


function isAllowed(request) {
  const origin = request.headers.get("Origin");
  if (ORIGIN_ALLOWLIST.includes(origin)) {
    return true;
  }

  if (origin === null) {
    // img tags have null origin but accurate referrer
    var referer = request.headers.get("Referer");
    if (referer === null) {
      return false;
    }
    if (referer.charAt(referer.length - 1) === '/') {
      referer = referer.substring(0, referer.length - 1);
    }
    return ORIGIN_ALLOWLIST.includes(referer);
  }

  return false;

}


async function sendRequest(request, requested_url) {
  var recv_headers = {};
  // pass along all headers but only if they wont stop our cors
  for (var pair of request.headers.entries()) {
      if (
        (pair[0].match("^origin") == null) && 
        (pair[0].match("referer") == null) && 
        (pair[0].match("^cf-") == null) && 
        (pair[0].match("^x-forw") == null) && 
        (pair[0].match("^x-cors-headers") == null)
      )
      recv_headers[pair[0]] = pair[1];
  }

  // send proxied request
  var proxyRequest = new Request(request, {
      "redirect": "follow",
      "headers": recv_headers
  });
  return fetch(requested_url, proxyRequest);

  // construct our response
}

function constructResponseHeaders(currResponseHeaders, requestHeaders) {
  var newHeaders = new Headers(currResponseHeaders);
  newHeaders.set("Access-Control-Allow-Origin", requestHeaders.get("Origin"));
  newHeaders.set("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
  const existing_acrh = requestHeaders.get("access-control-request-headers");
  if (existing_acrh) {
    newHeaders.set("Access-Control-Allow-Headers", existing_acrh);
  }
  newHeaders.delete("X-Content-Type-Options");
  return newHeaders;
}

