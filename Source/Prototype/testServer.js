var finalhandler = require('finalhandler')
var http = require('http')
var serveStatic = require('serve-static')
var qs = require('querystring')
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('ManyHands');


var serve = serveStatic('.', {"index": ['index.html','index.htm']})


function serveDynamic(req, res){
    //console.log(req.url)
    if(req.url === "/register"){
        var body = "";

        req.on('data', function (chunk){
            body += chunk.toString();
        });

        req.on('end', function(){
            registerReqCB(body, res);
        });
        //If the req url is "register", parse the posted params and add them to central server.
    }

    else if(req.url === "/login"){
        var body = "";

        req.on('data', function (chunk){
            body += chunk.toString();
        });

        req.on('end', function(){
            loginReqCB(body, res);
        });

        //If the req url is "login", parse the posted params and get link from CS.
        //Go to public link to TLD
        //Get file
        //Parse file. 
        //Get link to access_token
        //download encrypted access token
        //decrypt access token with password posted.
    }
    else if(req.url === "/user"){
        var body = "";
        req.on('data', function (chunk){
            body += chunk.toString();
        });

        req.on('end', function (chunk){
            checkUser(body, res);
        });
    }
    else{
        finalhandler(req, res);
    }
}

var server = http.createServer(function (req, res){
    //look at dmcc_server line 170
     
        serve(req, res, function(){ serveDynamic(req, res)});
});

server.listen(8080);

console.log("Server Running on 8080");

function loginReqCB(body, res){
    var postParams = qs.parse(body);

    var username = postParams['uid'];


    getTLDLink(username, res);
}

function registerReqCB(body, res){
    var postParams = qs.parse(body);

    var username = postParams['uid'];
    var tldLink = postParams['link'];

    createUser(username, tldLink, res);

}


function getTLDLink(username, res){
    db.each("SELECT publink FROM user WHERE uid='"+username+"'",
        function (err, row){
            if (err){
                res.writeHead(400, "NOK", {"Content-Type": "text/html"});
                res.end("Something went terribly awry!");
                console.log("Database error: ", err)
            }
            else{
                onTLDLink(row, res);
            }
        }
    );
}

function onTLDLink(row, res){
    var dbRow = JSON.stringify(row);
    res.writeHead(200, "OK", {"Content-Type": "text/html"});
    res.end(dbRow);

}


function createUser(username, publink, res){
    db.run('INSERT INTO user VALUES (?,?)', username, publink, 
        function (err){
            onUserInserted(err, res);
        });

}

function onUserInserted(err, res){
    if(err === null){
        console.log("Successfully registered");
        res.writeHead(200, "OK", {"Content-Type": 'text/html'});     
    }
    else{
        console.log("err: ", err);
        res.writeHead(400, "NOK", {"Content-Type": "text/html"})
    }
    res.end("");   
}

function checkUserCB(err, dbResp){
    console.log(dbResp);
}

function checkUser(request_data, res){
    var params = qs.parse(request_data);
    var username = params['uid']


    var json = '';
    db.all("SELECT * from user where uid='"+username+"'",function (err, rows){
        if(err){ 
            console.log("error: "+err);
            res.writeHead(404, 'Internal Server Error', {'Content-Type': 'text/html'});
        }

        else if(rows.length === 0){
            res.writeHead(404, 'NOT FOUND', {'Content-Type': 'text/html'});
        }
        else{
            json = JSON.stringify(rows);
            
            res.writeHead(200, 'OK', {'Content-Type': 'application/json'})
            //callback(null, json);
        }
        res.end(json);
    })

}
