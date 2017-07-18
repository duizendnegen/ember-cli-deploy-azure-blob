/* jshint node: true */
'use strict';

var DeployPluginBase = require('ember-cli-deploy-plugin');
var azure       = require('azure-storage');
var Promise     = require('rsvp').Promise;
var walk        = require('walk');
var fs          = require('fs');
var path        = require('path');
var mime        = require('mime');

module.exports = {
  name: 'ember-cli-deploy-azure-blob',

  createDeployPlugin: function(options) {
    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,

      defaultConfig: {
        containerName: 'emberdeploy',
        cacheControl: {
          extensions: [
            { extension: 'png', policy: 'max-age=604800' },
            { extension: 'jpg', policy: 'max-age=604800' },
            { extension: 'gif', policy: 'max-age=604800' },
            { extension: 'jpeg', policy: 'max-age=604800' },
            { extension: 'css', policy: 'max-age=86400' },
            { extension: 'js', policy: 'max-age=86400' }
          ]
        }
      },

      _createClient: function() {
        var connectionString = this.readConfig("connectionString");
        var storageAccount = this.readConfig("storageAccount");
        var storageAccessKey = this.readConfig("storageAccessKey");

        if(connectionString) {
          return azure.createBlobService(connectionString);
        } else if(storageAccount && storageAccessKey) {
          return azure.createBlobService(storageAccount, storageAccessKey);
        } else {
          throw new Error("Missing connection string or storage account / access key combination.");
        }
      },

      configure: function(context) {
        this._super.configure.apply(this, context);

        if(!this.pluginConfig.connectionString) {
          ['storageAccount', 'storageAccessKey'].forEach(this.ensureConfigPropertySet.bind(this));
        }
      },

      upload: function(context) {
        var client = this._createClient();
        var _this = this;

        var containerName = this.readConfig("containerName");
        var distDir       = context.distDir;
        var shouldDeleteBlobs = this.readConfig("deleteBlobs");
        this.log("uploading files from " + distDir + "...", { verbose: true });

        var gzippedFiles = context.gzippedFiles || [];
        var correctedGzippedFiles = gzippedFiles.map(function(gzippedFile) {
          return path.normalize(gzippedFile);
        });

        var createContainer = function(){
          return new Promise(function(resolve, reject){
            client.createContainerIfNotExists(containerName, {publicAccessLevel : 'blob'}, function(error, result, response){
              if(error){ return reject(error); }
              resolve();
            });
          });
        };

        var setProperties = function(){
          return new Promise(function(resolve, reject){
            // set CORS
            var serviceProperties = {
              Cors: {
                CorsRule: [{
                  AllowedOrigins: ['*'],
                  AllowedMethods: ['GET'],
                  AllowedHeaders: [],
                  ExposedHeaders: [],
                  MaxAgeInSeconds: 60
                }]
              }
            };
            client.setServiceProperties(serviceProperties, function(error, result, response) {
              if(error){ return reject(error); }
              resolve();
            });
          });
        };

        var listAllBlobs = function(){
          var blobs = [];
          var listBlobs = function(continuationToken){
            return new Promise(function(resolve, reject){
              client.listBlobsSegmented(containerName, continuationToken, function(error, result, response){
                if(error){ return reject(error); }
                blobs = blobs.concat(result.entries.map(e => e.name));
                if(result.continuationToken){ return resolve(listBlobs(result.continuationToken)); }
                resolve(blobs);
              });
            });
          };
          
          return listBlobs();
        };

        var deleteAllBlobs = function(blobs){
          var deleteBlob = function(blob){
            return new Promise(function(resolve, reject){
              client.deleteBlob(containerName, blob, { deleteSnapshots: azure.BlobUtilities.SnapshotDeleteOptions.BLOB_AND_SNAPSHOTS}, function(error, result, response){
                if(error){ return reject(error); }
                resolve();
              });
            });
          };

          return Promise.all(blobs.map(deleteBlob));
        };

        var doUpload = function(){
          return new Promise(function(resolve, reject){
            // walk the directory to be uploaded
            var walker = walk.walk(distDir, { followLinks: false });

            walker.on("file",  function (root, fileStats, next) {
              _this._uploadFile(root, fileStats, next, context.distDir, client, correctedGzippedFiles);
            });

            walker.on("errors", function(root, nodeStatsArray, next) {
              nodeStatsArray.forEach(function (n) {
                _this.log("[ERROR] " + n.name, {color: 'red', verbose: true});
                _this.log(n.error.message || (n.error.code + ": " + n.error.path), {color: 'red'});
              });
              reject();
            });

            walker.on("end", function() {
              _this.log("upload succeeded");
              resolve();
            });
          });
        };

        if(shouldDeleteBlobs){
          return createContainer()
            .then(setProperties)
            .then(listAllBlobs)
            .then(deleteAllBlobs)
            .then(doUpload);
        }
        return createContainer()
          .then(setProperties)
          .then(doUpload);
      },

      _uploadFile: function(root, fileStat, next, distDir, client, gzippedFiles) {
        var _this = this;

        var containerName = this.readConfig("containerName");

        var resolvedFile = path.resolve(root, fileStat.name);
        var normalizedRoot = path.normalize(root);
        var targetDirectory = normalizedRoot === distDir ? undefined : normalizedRoot.replace(distDir + path.sep, "");

        var targetFile = targetDirectory ? targetDirectory + path.sep + fileStat.name : fileStat.name;

        var options = {}

        if (gzippedFiles.indexOf(targetFile) != -1) {
          options["contentEncoding"] = "gzip";
        }

        // Set the cache control policy.
        options['cacheControl'] = this._cacheControlPolicy(fileStat);

        client.doesBlobExist(containerName, targetFile, function(error, blobExists, response) {
          if(blobExists === true) {
            next();
          } else {
            client.createBlockBlobFromLocalFile(containerName, targetFile, resolvedFile, options, function(error, result, response){
              if(!error){
                // file uploaded
                _this.log("Uploaded " + targetFile, { verbose: true });
              } else {
                _this.log("Error uploading " + targetFile, { color: 'red'});
                _this.log(error, { color: 'red', verbose: true});
              }

              next();
            });
          }
        });
      },

      _cacheControlPolicy: function(fileStat) {
        var cacheControl = this.readConfig('cacheControl');

        // Default cache policy.
        var policy = 'no-cache, must-revalidate';

        // Check for cache control extensions matches.
        if (typeof cacheControl.extensions !== 'undefined') {
          var validExtension = cacheControl.extensions.find(function(option) {
            return option.extension === fileStat.name.split('.').pop(); // Get only the extension of the file.
          });

          if (typeof validExtension !== 'undefined') {
            policy = validExtension.policy;
          }
        }

        return policy;
      }
    });

    return new DeployPlugin();
  }
};
