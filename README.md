# Ember-cli-deploy-azure-blob

Deploy assets from Ember App to Azure Blob using [ember-cli-deploy](https://github.com/ember-cli/ember-cli-deploy).

+[![](https://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/plugins/ember-cli-deploy-azure-blob.svg)](http://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/)

See [ember-cli-deploy-azure](https://github.com/duizendnegen/ember-cli-deploy-azure) for a plugin pack for Azure Tables, Azure Blob & the default build and hashing included.

## Installation

* `npm install ember-cli-deploy-azure-blob`
* `npm install ember-cli-deploy-build` (or another ember-cli-deploy build tool)

## Configuration

In your `config/deploy.js` file:
```javascript
module.exports = function(environment) {
  var ENV = {};

  if (environment === 'production') {
    ENV["azure-blob"] = {
      storageAccount: "my-storage-account",
      storageAccessKey: "my-access-key",
      containerName: "my-container-name" // defaults to 'emberdeploy'
    };
  }

  return ENV;
}
```

You can also connect using your connection string, set it as `connectionString: "my-connection-string"`.
It's possible to gzip assets, but it leads to strange results (https://github.com/duizendnegen/ember-cli-deploy-azure/issues/6).

## Usage

* `ember deploy <environment>` to build and upload all assets to the Azure Blob
