const flowFunctions = require('@catfoxtech/node-red-contrib-flow-functions');
flowFunctions.start();

exports.function = async (data, context, callback) => {
    await flowFunctions.triggerFlow({type: 'gcp-cloud-functions-topic-in'}, data, context, callback);
};
