// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, or any plugin's
// vendor/assets/javascripts directory can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file. JavaScript code in this file should be added after the last require_* statement.
//
// Read Sprockets README (https://github.com/rails/sprockets#sprockets-directives) for details
// about supported directives.
//
//= require rails-ujs
//= require activestorage
//= require turbolinks
//= require jquery-3.3.1.min
//= require_tree .

// import { isCrossOrigin, parseUrlOrigin } from './detectCrossOrigin.browser'
// import { STREAM_DATA, FAIL_EVENT, HTTP_START, STREAM_END, ABORTING, errorReport } from './events'
// import { len } from './util'
// import { parseResponseHeaders } from './parseResponseHeaders.browser'
// import { partialComplete } from './functional'

// function httpTransport () {
//     return new XMLHttpRequest()
// }

/**
 * A wrapper around the browser XmlHttpRequest object that raises an
 * event whenever a new part of the response is available.
 *
 * In older browsers progressive reading is impossible so all the
 * content is given in a single call. For newer ones several events
 * should be raised, allowing progressive interpretation of the response.
 *
 * @param {Function} oboeBus an event bus local to this Oboe instance
 * @param {XMLHttpRequest} xhr the xhr to use as the transport. Under normal
 *          operation, will have been created using httpTransport() above
 *          but for tests a stub can be provided instead.
 * @param {String} method one of 'GET' 'POST' 'PUT' 'PATCH' 'DELETE'
 * @param {String} url the url to make a request to
 * @param {String|Null} data some content to be sent with the request.
 *                      Only valid if method is POST or PUT.
 * @param {Object} [headers] the http request headers to send
 * @param {boolean} withCredentials the XHR withCredentials property will be
 *    set to this value
 */
function streamingHttp (method, url, data, headers, withCredentials, handler) {
    'use strict';

    var xhr = new XMLHttpRequest();

    // var emitStreamData = oboeBus(STREAM_DATA).emit
    // var emitFail = oboeBus(FAIL_EVENT).emit
    var numberOfCharsAlreadyGivenToCallback = 0;
    var stillToSendStartEvent = true;

    // When an ABORTING message is put on the event bus abort
    // the ajax request
    // oboeBus(ABORTING).on(function () {
    //     // if we keep the onreadystatechange while aborting the XHR gives
    //     // a callback like a successful call so first remove this listener
    //     // by assigning null:
    //     xhr.onreadystatechange = null
    //
    //     xhr.abort()
    // })
    // TODO implement

    /**
     * Handle input from the underlying xhr: either a state change,
     * the progress event or the request being complete.
     */
    function handleProgress () {
        if (String(xhr.status)[0] === '2') {
            var textSoFar = xhr.responseText;
            var newText = (' ' + textSoFar.substr(numberOfCharsAlreadyGivenToCallback)).substr(1);

            /* Raise the event for new text.

             On older browsers, the new text is the whole response.
             On newer/better ones, the fragment part that we got since
             last progress. */

            if (newText) {
                // emitStreamData(newText);
                handler.onChunk(newText);
            }

            numberOfCharsAlreadyGivenToCallback = textSoFar.length;
        }
    }

    if ('onprogress' in xhr) { // detect browser support for progressive delivery
        xhr.onprogress = handleProgress;
    }

    function sendStartIfNotAlready (xhr) {
        // Internet Explorer is very unreliable as to when xhr.status etc can
        // be read so has to be protected with try/catch and tried again on
        // the next readyState if it fails
        try {
            // stillToSendStartEvent && oboeBus(HTTP_START).emit(
            //     xhr.status,
            //     parseResponseHeaders(xhr.getAllResponseHeaders()))
            // stillToSendStartEvent && handler.onStart(
            //     xhr.status,
            //     parseResponseHeaders(xhr.getAllResponseHeaders()));
            stillToSendStartEvent && handler.onStart(
                xhr.status,
                xhr.getAllResponseHeaders());
            stillToSendStartEvent = false;
        } catch (e) { /* do nothing, will try again on next readyState */ }
    }

    xhr.onreadystatechange = function () {
        switch (xhr.readyState) {
            case 2: // HEADERS_RECEIVED
            case 3: // LOADING
                return sendStartIfNotAlready(xhr);

            case 4: // DONE
                sendStartIfNotAlready(xhr); // if xhr.status hasn't been available yet, it must be NOW, huh IE?

                // is this a 2xx http code?
                var successful = String(xhr.status)[0] === '2';

                if (successful) {
                    // In Chrome 29 (not 28) no onprogress is emitted when a response
                    // is complete before the onload. We need to always do handleInput
                    // in case we get the load but have not had a final progress event.
                    // This looks like a bug and may change in future but let's take
                    // the safest approach and assume we might not have received a
                    // progress event for each part of the response
                    handleProgress();

                    // oboeBus(STREAM_END).emit()
                    handler.onClose();
                } else {
                    // emitFail(errorReport(
                    //     xhr.status,
                    //     xhr.responseText
                    // ))
                    handler.onError(
                        xhr.status,
                        xhr.responseText
                    );
                }
        }
    }

    try {
        xhr.open(method, url, true);

        for (var headerName in headers) {
            xhr.setRequestHeader(headerName, headers[headerName])
        }

        // if (!isCrossOrigin(window.location, parseUrlOrigin(url))) {
        //     xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
        // }

        xhr.withCredentials = withCredentials;

        xhr.send(data)
    } catch (e) {
        // To keep a consistent interface with Node, we can't emit an event here.
        // Node's streaming http adaptor receives the error as an asynchronous
        // event rather than as an exception. If we emitted now, the Oboe user
        // has had no chance to add a .fail listener so there is no way
        // the event could be useful. For both these reasons defer the
        // firing to the next JS frame.
        // window.setTimeout(
        //     partialComplete(handler.onError, errorReport(undefined, undefined, e))
        //     , 0
        // )
    }
}

var handler = {
    onStart: function(status, headers){
        $('#stream-log').append('<li>steaming started</li>');
        // console.log('on start');
    },
    onChunk: function(chunk_data){
        $('#stream-log').append('<li>chunk: ' + chunk_data + '</li>');
        // console.log('chunk: ' + chunk_data);
    },
    onClose: function () {
        $('#stream-log').append('<li>stream closed</li>');
        // console.log('closed');
    },
    onError: function (status, response) {
        $('#stream-log').append('<li>error on stream: ' + response + '</li>');
        // console.log('error');
    }
};

streamingHttp ('GET', '/stream', null, {}, false, handler);

// var idx = 0;
// oboe('/stream')
//     .node('*', function( anything ){
//
//         // This callback will be called everytime a new object is
//         // found in the foods array.
//
//         idx += 1;
//         console.log('next batch ' + idx);
//         // console.dir( anything);
//     })

// var oboe = require('oboe');
// console.dir(oboe);
