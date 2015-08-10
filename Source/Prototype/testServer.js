var finalhandler = require('finalhandler')
var http = require('http')
var serveStatic = require('serve-static')
var qs = require('querystring')
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('ManyHands');


var serve = serveStatic('.', {"index": ['index.html','index.htm']})


var server = http.createServer(function (req, res){

    if(req.method=="POST"){
        var body="";
        req.on('data', function (chunk){
            body += chunk.toString();
        });

        var callback = function(err, result){
            if(err)
                res.writeHead(400, "NOK", {"Content-Type": 'text/html'})
            res.writeHead(200, "OK", {"Content-Type": 'text/html'});
            res.end(result);
        };

        req.on('end', function(){
            return postReqCB(body, callback);            
        });


    }
    else{
        var done = finalhandler(req, res)
        serve(req, res, done)
    }
});

server.listen(8080);

console.log("Server Running on 8080");

function postReqCB(body, callback){
    var post = qs.parse(body);
    var username = "";
    var publink = "";

    if(post['login_username']){
        if(!post['pwd']){
            return false;
        }
        username = post['login_username'];
        console.log("username: ", username);
        checkUser(username, callback)
    }
    else if(post['create_username']){
        username = post['create_username'];
        publink = post['publink']
        createUser(username, publink)
        console.log(post);
    }
    else{
        console.log("Something went terribly awry");
    }
}

function createUser(username, publink, callback){
    db.serialize(function(){
        var stmt = db.prepare('INSERT INTO user VALUES (?,?)');
        stmt.run(username, publink);
        stmt.finalize();
    })
    callback();
}


function checkUser(username, callback){
    var json = '';
    db.all("SELECT uid, publink from user where uid="+username+"",function(err, rows){
        if(err){ 
            console.log("error: "+err);
            callback(err, null);
        }

        else if(rows.length === 0){
            callback(err, null);

        }
        else{
            json = JSON.stringify(rows);
            callback(null, json);
        }
    })

}

