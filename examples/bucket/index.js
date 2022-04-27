const flowFunctions = require('@catfoxtech/node-red-contrib-flow-functions');
flowFunctions.start();

exports.function = async (file, context, callback) => {
    await flowFunctions.triggerFlow({type: 'gcp-cloud-functions-bucket-in'}, file, context, callback);
};
