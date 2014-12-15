# REDM the Redis ODM

This project is a driver for the [NodeJS NoSQL ODM](https://github.com/ichiriac/node-nosql-odm/), visit this repository for further informations.

*Current version: [v/0.1.0][dist]*

[![Build Status](https://travis-ci.org/ichiriac/redm.svg)](https://travis-ci.org/ichiriac/sofa-odm)
[![Dependency Status](https://david-dm.org/ichiriac/redm.svg)](https://david-dm.org/ichiriac/sofa-odm)
[![Coverage Status](https://coveralls.io/repos/ichiriac/redm/badge.png?branch=master)](https://coveralls.io/r/ichiriac/redm)

## Getting started

```sh
npm install redm --save
```

## Sample code

```js
var sofa = require('redm');
var session = new redm();
// handles all errors
session.on('error', function(err) {
  console.error(err);
});
// declare a user mapper attached to current session
var users = session.declare('user', {
  // declare properties
  properties: {
    name: {
      type: 'string',       // data type : string, number, boolean, array, object
      validate: [4, 64]     // validators, depends on data type
    },
    email: {
      type: 'string',
      validate: /S+@S+\.S+/,
      unique: true
    },
    password: {
      type: 'string',
      validate: [6, 24]
    }
  }
});
// connect to couchbase
session.connect({
  // connection parameters
  host: 'localhost:8091',
  database: 1
}).then(function() {
  // creates a new entry
  var john = users.create({
    name: 'John Doe',
    email: 'john@doe.com',
    password: 'secret'
  });
  // saves the active record
  john.save()
    // use a email view to find the user
    .then(function() {
      return users.find('email', 'john@doe.com');
    })
    // deletes the first found record
    .then(function(result) {
      return result.rows[0].remove();
    })
    .done()
  ;
}).done();
```

#Misc

This code is distribute under The MIT License (MIT), authored by Ioan CHIRIAC.
