const flowFunctions = require('@catfoxtech/node-red-contrib-flow-functions');
flowFunctions.start();

exports.function = async (req, res) => {
    await flowFunctions.triggerFlow({type: 'gcp-cloud-functions-http-in'}, req, res);
};
