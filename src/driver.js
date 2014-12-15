var redis = require('redis');

/**
 * Defines the redis driver
 */
module.exports = function(manager) {
  return {
    cnx: null,
    scripts: {},
    /** Connects **/
    connect: function(options, result) {
      if (this.cnx) this.shutdown();
      var host = (options.host ? options.host : '127.0.0.1:6379').split(':');
      var port = (host.length == 2) ? host[1] : '6379';
      var db = options.database && options.database.length > 0 ? 
        options.database.substring(1) : null
      ;
      var self = this;
      host = host[0];
      this.cnx = redis.createClient(port, host, options.params);
      this.cnx.on('error', function(err) {
        manager.emit('error', err);
        if (!self.cnx.connected) {
          result.reject(err);
          self.shutdown();
        }
      });
      this.cnx.on('connect', function() {
        if (db) {
          self.cnx.select(db, function(err,res){
            if (err) {
              manager.emit('error', err);
              result.reject(err);
              self.shutdown();
            } else {
              result.resolve(manager, self);
              manager.emit('connect', manager, self);
            }
          });
        } else {
          result.resolve(manager, self);
          manager.emit('connect', manager, self);
        }
      });
      return result;
    }
    /** Close the connection **/
    ,shutdown: function(result) {
      if (this.cnx) {
        this.cnx.quit();
        this.cnx = null;
        manager.emit('disconnect', manager);
      }
      if (result) result.resolve(manager);
      return result;
    }
    /** Sets an LUA script **/
    ,setScript: function(name, code) {
      var result = manager.q.defer();
      var self = this;
      this.scripts[name] = {
        code: code,
        sha: null
      };
      this.cnx.script('load', code, function(err, hash) {
        if (err) {
          manager.emit('error', err);
          result.reject(err);
        } else {
          self.scripts[name].sha = hash;
          result.resolve(hash);
        }
      });
      return result.promise;
    }
    /** Runs a script **/
    ,runScript: function() {
      var args = Array.prototype.slice.call(arguments);
      var result = manager.q.defer();
      if (!this.scripts.hasOwnProperty(args[0])) {
        result.reject(new Error('Undefined script ' + args[0]));
      } else {
        args[0] = this.scripts[args[0]].sha;
        args.push(function(err, res) {
          if (err) {
            manager.emit('error', err);
            result.reject(err);
          } else {
            result.resolve(res);
          }
        });
        this.cnx.evalsha.apply(this.cnx, args);
      }
      return result.promise;
    }
    /** Defines indexes **/
    ,setup: function(view, result) {
      var scripts = {};
      var namespace = view.mapper.options.type;
      for(var name in view.views) {
        var v = view.views[name];
        scripts[name] = {
          write: function(object, multi) {
            multi.sadd(namespace, object._id);
            var key = '';
            for(var i = 0; i < v.properties.length; i++) {
              key += ':' + object[v.properties[i]];
            }
            if (v.type == 'unique') {
              multi.set(namespace + ':' + name + ':' + key, object._id);
            } else if (v.type == 'index') {
              multi.sadd(namespace + ':' + name + ':' + key, object._id);
            }
          },
          remove: function(object, multi) {
          }
        };
      }
      this.scripts[namespace] = scripts;
      result.resolve(scripts);
      view.mapper.emit('setup', scripts);
      return result;
    }
    /** Increment the specified key **/
    ,incr: function(self, key, options, result) {
      if (!result) {
        result = options;
        options = null;
      }
      this.cnx.incr(
        key, function(err, data) {
          if (err) {
            result.reject(err);
            self.emit('error', err);
          } else {
            result.resolve(data);
            self.emit('next', data);
          }
        }
      );
      return result;
    }
    /** Requests some data **/
    ,request: function(self, view, criteria, result) {
      result.reject(null);
      return result;
    }
    /** Writes the specified document **/
    ,set: function(self, key, object, wait, result) {
      this.cnx.hmset(key, object, function(err, res) {
        if (err) {
          result.reject(err);
          object.emit('error', err);
          self.emit('error', err); kl
        } else {
          result.resolve(object);
          object.emit('saved', self);
          self.emit('saved', self);
        }
      });
      return result;
    }
    /**Removes the specified document **/
    ,remove: function(self, mapper, key, wait, result) {
      this.cnx.del(key, function(err, res) {
        if (err) {
          result.reject(err);
          self.emit('error', err);
          mapper.emit('error', err);
        } else {
          // reset the current field ID
          self._id = false;
          result.resolve(self);
          self.emit('removed', self);
          mapper.emit('removed', self);
        };
      });
      return result;
    }
  };
};