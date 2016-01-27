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

### Connection String
You can also connect using your connection string, set it as `connectionString: "my-connection-string"`.

### Gzip Support
If you're using [ember-cli-deploy-gzip](https://github.com/ember-cli-deploy/ember-cli-deploy-gzip) to automatically compress your assets using gzip, this plugin will automatically detect files that have been gzipped and set the proper `Content-Encoding` header within Azure Blob Storage.


## Usage

* `ember deploy <environment>` to build and upload all assets to the Azure Blob
