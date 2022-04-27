const headless = process.env.NODE_ENV === 'production';

const path = require('path');
const userDir = path.resolve('node-red');

const embedded = {
    SKIP_BUILD_CHECK: headless,
    credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET,
    debugUseColors: !headless,
    disableEditor: headless,
    externalModules: {
        // If autoInstall is set, then the runtime will reinstall any palette modules it finds are missing compared to the last time it was running.
        // It does not (currently) apply that logic to the Function external modules. That is an oversight and something we need to address
        // But the key thing is - autoInstall isn’t about automatically figuring out what extra modules are needed and installing them. It is about reinstalling things that are missing compared to the last time it was running.
        // This is used in container-based environments where, after a container is restarted, the local node_modules folder could have been reset back to its original state. Node-RED keeps a list of the nodes it discovers each time it starts up, and can use that list to spot things that are missing and reinstall them.
        // But we don’t keep a similar list (in runtime settings) of the function node modules that were installed - which is the bit that needs addressing
        autoInstall: !headless,
        palette: {
            allowInstall: !headless,
            allowUpload: !headless // TODO should this always be false?
        },
        modules: {
            // externalModules.modules.allowInstall determines whether nodes are allowed to dynamically install additional modules
            // If allowInstall is false, a Function node could still use the feature - but would only be able to use modules that were already installed (such as the core node.js modules)
            allowInstall: !headless // TODO should this always be false?
        }
    },
    flowFile: 'flows.json',
    flowFilePretty: true,
    // functionExternalModules is specially whether the Function node allows extra modules to be specified
    functionExternalModules: true,
    functionGlobalContext: {},
    httpAdminRoot: headless ? false : '/',
    httpNodeRoot: headless ? false : '/', // TODO should this always be false?
    logging: {
        console: {
            // level: 'trace'
        }
    },
    readOnly: headless,
    // uiHost: undefined,
    uiPort: process.env.NODE_RED_UI_PORT || 1880,
    userDir
};

if (headless) {
    embedded.logging.console.handler = function (/*settings*/) {
        // https://cloud.google.com/functions/docs/monitoring/logging#writing_structured_logs
        // https://cloud.google.com/logging/docs/agent/logging/configuration#special-fields
        // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
        return function (msg) {
            let method;
            let severity;
            switch (msg.level) {
                case RED.log.FATAL:
                    method = 'error';
                    severity = 'CRITICAL';
                    break;
                case RED.log.ERROR:
                    method = 'error';
                    severity = 'ERROR';
                    break;
                case RED.log.WARN:
                    method = 'warn';
                    severity = 'WARNING';
                    break;
                case RED.log.DEBUG:
                    method = 'debug';
                    severity = 'INFO';
                    break;
                case RED.log.TRACE:
                case RED.log.AUDIT:
                case RED.log.METRIC:
                    method = 'trace';
                    severity = 'DEBUG';
                    break;
                case RED.log.INFO:
                default:
                    method = 'info';
                    severity = 'NOTICE';
            }

            // NOTE: log messages originating from Debug node are already stringified
            let logEntry;
            if (typeof msg.msg === 'object') {
                logEntry = Object.assign({}, msg.msg, {severity});
            } else {
                let message = RED.util.ensureString(msg.msg);
                logEntry = {
                    severity,
                    message: message
                };
            }

            console[method](JSON.stringify(logEntry));
        };
    };
}

const RED = require('node-red');

function flowsStarted() {
    return new Promise(function (resolve) {
        RED.events.on('flows:started', function () {
            resolve(RED);
        });
    });
}

const coldStart = flowsStarted();

const _ = require('lodash');

async function send(msg, flow, flows) {
    if (flow === undefined) {
        flow = {type: 'tab'}; // default to first flow
    } else if (_.isString(flow)) {
        flow = _.overSome({id: flow}, {label: flow}); // assume string is node ID or label
    }

    if (flows === undefined) {
        flows = (await RED.runtime.flows.getFlows({})).flows;
    }

    const node = _.find(flows, flow);
    if (node) {
        if (node.type === 'tab') { // find first cloud function input node in flow
            return send(msg, function (node) {
                return node.z === node.id && /^gcp-cloud-functions-(http|bucket|topic)-in$/.test(node.type);
            }, flows);
        } else {
            return RED.nodes.getNode(node.id).receive(msg);
        }
    }
}

// https://cloud.google.com/functions/docs/concepts/events-triggers#event_data
// https://cloud.google.com/functions/docs/calling/http#http_requestresponse_structure
// https://cloud.google.com/functions/docs/writing/background#function_parameters
// https://cloud.google.com/functions/docs/calling/pubsub#event_structure
// https://cloud.google.com/functions/docs/calling/storage#event_structure
// https://cloud.google.com/functions/docs/writing/background#terminating_background_functions
// https://cloud.google.com/functions/docs/concepts/nodejs-runtime#signal-termination

module.exports = {

    start: function (overrides) {
        const settings = Object.assign({}, embedded, overrides);

        let app;
        let server;
        if (!headless) {
            const express = require('express');
            app = express();
            app.use('/', express.static('public'));

            const http = require('http');
            server = http.createServer(app);
        }

        RED.init(server, settings);

        if (app) {
            app.use(settings.httpAdminRoot, RED.httpAdmin);
        }
        if (server) {
            server.listen(settings.uiPort, settings.uiHost);
        }

        return RED.start();
    },

    triggerFlow: function (flow, ...funcParameters) {
        if (funcParameters) {
            let msg;

            if (funcParameters.length === 3 && typeof funcParameters[2] === 'function') {
                msg = {
                    payload: funcParameters[0],
                    context: funcParameters[1],
                    func: funcParameters[2],
                };
            } else if (funcParameters.length === 2 && funcParameters[0].res === funcParameters[1]) {
                msg = {
                    req: funcParameters[0],
                    res: funcParameters[1],
                };
            }

            if (msg) {
                return coldStart.then(function () {
                    return send(msg, flow);
                });
            }
        }
    }
};
