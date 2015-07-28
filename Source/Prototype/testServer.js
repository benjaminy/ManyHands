var finalhandler = require('finalhandler');
var http = require('http');
var serveStatic = require('serve-static');
var qs = require('querystring');
var url = require('url');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('ManyHands');


var serve = serveStatic('.', {"index": ['index.html','index.htm']})


var server = http.createServer(function (req, res){
    full_url = url.parse(req.url);
    var requestBody = "";
    var callback = function(err, result){
        if(err)
            res.writeHead(400, "NOK", {"Content-Type": 'text/html'})
        else if(result === null){
            res.writeHead(401, "NOK", {"Content-Type": 'text/html'})
            res.end("Something went wrong.")
        }
        else{
            res.writeHead(301, {'Location': 'http://localhost:8080/Prototype.html'});
            res.end(result);
        }
    };

    if(full_url.pathname === "/get_url"){
        userid = full_url.query;

        return checkUser(userid, callback)

    }

    if(req.url === "/register"){
        req.on('data', function (chunk){
            requestBody += chunk.toString();
        });

        req.on('end', function(){
            var post = qs.parse(requestBody);
            res.writeHead(200, "OK", {'Content-Type': 'text/html'});
            res.end();
            createUser(post, callback);
        })
        
    }
    
    else{
        var done = finalhandler(req, res)
        serve(req, res, done)
    }
});

server.listen(8080);

console.log("Server Running on 8080");



function createUser(data, callback){
    if(!data['create_username'] || !data['publink']){
        console.log("Username and/or link not entered.")
    }
    db.serialize(function(){
        var stmt = db.prepare('INSERT INTO user VALUES (?,?)');
        stmt.run(username, publink);
        stmt.finalize();
    })
    callback();
}




function checkUser(body, callback){
    var post = qs.parse(body);
    var username = body;


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

