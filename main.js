var request = require('request');
var cheerio = require('cheerio');
var spoof = require('spoof');
var cp = require('child_process')
var j = request.jar()
var request = request.defaults({ jar : j })

function rnd() {
  return Math.floor((Math.random() * 89999) + 10000).toString();
}

function setMACAddress(device, mac, port) {
  if (process.getuid() !== 0) {
    throw new Error('Must run as root (or using sudo) to change network settings');
  }
  try {
    spoof.setInterfaceMAC(device, mac, port)
  } catch (err) {
    throw new Error(err)
  }
}

var it = spoof.findInterface('en0');
var mac = spoof.random();
setMACAddress(it.device, mac, it.port)
cp.execSync('networksetup -setairportnetwork en0 xfinitywifi').toString();

console.log('mac', mac);

var waitForXfinity = function() {
  return new Promise(function(resolve, rejcect) {
    var doit = function() {
      console.log('doit');
      request('https://xfinity.nnu.com/xfinitywifi/main', function(error, response, html) {
        if(error == null) {
          resolve();
        } else {
          setTimeout(doit, 250);
        }
      });
    }
    doit();
  });
}

var setClientMac = function() {
  return new Promise(function(resolve, rejcect) {
    request('https://xfinity.nnu.com/xfinitywifi/?client-mac=' + mac, function(error, response, html) {
      resolve();
    });
  });
}

var validate = function(key_val) {
  var form_val = {
        rateplanid:'spn',
        spn_postal:rnd(),
        spn_email:rnd() + '@' + rnd() + '.com',
        spn_terms:1
      };
  if(key_val) {
    form_val.key = key_val;
  }
  return new Promise(function(resolve, rejcect) {
    request.post({url:'https://xfinity.nnu.com/xfinitywifi/signup/validate',
      form: form_val}, function(err,httpResponse,body){
        console.log(body);
        resolve();
    })
  });
}

var signup = function() {
  var loginid = Math.round((new Date()).getTime() / 1000);
  return new Promise(function(resolve, rejcect) {
    var doit = function() {
      console.log('doit');
      request('https://xfinity.nnu.com/xfinitywifi/signup?loginid=' + loginid, function(error, response, html) {
        //console.log(response);
        console.log(html);
        if(error == null) {
          var response = JSON.parse(html);
          if(response.status === 'done') {
            resolve();            
          } else {
            setTimeout(doit, 100);
          }
        } else {
          setTimeout(doit, 250);
        }
      });
    }
    doit();
  });  
}

waitForXfinity().then(function() {
  setClientMac().then(function() {
    var cookie = request.cookie('planid=spn');
    var url = 'https://xfinity.nnu.com';
    j.setCookie(cookie, url);
    validate('rateplanid').then(function() {
      validate('spn_postal').then(function() {
        validate('spn_email').then(function() {
          validate('spn_terms').then(function() {
            validate().then(function() {
              signup().then(function() {
                console.log('done');
              });
            });
          });
        });
      });
    });
  });
});
