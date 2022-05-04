node-red-contrib-flow-functions
===============================

Embed Node-RED flow as a Google Cloud Function. Requires `@catfoxtech/node-red-contrib-google-cloud-functions` for
input/output nodes.

# Basic Usage

    const nodeRedSettingsOverrides = {};

    const flowFunctions = require('@catfoxtech/node-red-contrib-flow-functions');
    flowFunctions.start(nodeRedSettingsOverrides);

    const flow = <input node ID or label|tab name containing input node|lodash find predicate>;
    
    // Bucket trigger
    exports.function = async (file, context, callback) => {
        await flowFunctions.triggerFlow(flow, file, context, callback);
    };

    // HTTP trigger
    exports.function = async (req, res) => {
        await flowFunctions.triggerFlow(flow, req, res);
    };

    // Topic trigger
    exports.function = async (data, context, callback) => {
        await flowFunctions.triggerFlow(flow, data, context, callback);
    };

See `examples/` directory for more info.

When running locally (`NODE_ENV !== 'production'`), starts Node-RED UI on port 1880 or `NODE_RED_UI_PORT`. Runs 
headless on Google Cloud Functions (`NODE_ENV === 'production'`).
