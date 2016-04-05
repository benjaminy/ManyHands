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
    else if(req.url === "/teamversion"){
        var body = "";
        req.on('data', function(chunk){
            body += chunk.toString();
        });

        req.on('end', function(chunk){
            updateTeamVersion(body, res);
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
    var pubkey = postParams['pubkey'];

    createUser(username, tldLink, pubkey, res);

}

function updateTeamVersion(body, res){
    var postParams = qs.parse(body);
    
    var team_uuid = postParams['team_uuid'];
    var version_number = postParams['version_number'];
    var updating_user = postParams['user'];
    var last_update = postParams['last_update'];
    var pubkey;
    console.log("team_update: ", team_uuid, version_number, updating_user, last_update);

    db.each("SELECT pubkey FROM user WHERE uid='"+updating_user+"'",
        function(err, row){
            if(err){
                console.log("err: ", err);
            }
            else{
                pubkey = row['pubkey'];
                db.run("INSERT OR IGNORE INTO team_table VALUES(?, ?, ?)", team_uuid, version_number, pubkey,
                    function(err){
                        if(!err){
                            db.each("SELECT * FROM team_table WHERE team_uuid='"+team_uuid+"'",
                                function(err, row){
                                    if (err){
                                        console.log("error: ", err)
                                        onTeamVersionUpdate(err, res, "ERR")
                                    }
                                    else{
                                        var updated_user = row['user'];
                                        if(version_number > row['revision']){
                                            db.run("UPDATE team_table SET revision='"+version_number+"', user='"+pubkey+"' WHERE team_uuid='"+team_uuid+"'",
                                                function (error){
                                                    if(error){
                                                        console.log("UPDATE ERROR: ", error);
                                                    }
                                                    else{
                                                        console.log(team_uuid+" Updated by "+ updating_user);
                                                        onTeamVersionUpdate(err, res, "ServerUpdated", updated_user, updating_user, last_update);
                                                    }
                                                });
                                        }
                                        else if(version_number == row['revision']){
                                            onTeamVersionUpdate(err, res, "UserAlreadyUpdated", updated_user, updating_user, last_update);
                                        }
                                        else if(version_number < row['revision']){
                                            onTeamVersionUpdate(err, res, "NeedsUpdate", updated_user, updating_user, last_update);
                                        }
                                    }
                                }
                            );
                        }
                        else{
                            console.log("error: ", err);
                        }
                    });
            }
        })
}

function onTeamVersionUpdate(err, res, updated, updated_user, updating_user, last_update){
    var resp;   
    db.all("SELECT uid FROM user WHERE pubkey='"+updated_user+"'",
        function (error, rows){
            if(error){
                console.log("ERROR: ", err)
                resp = "Something went terribly awry";
                res.writeHead(400, "Bad Request", {"Content-Type": "text/html"});
                res.end(resp);
            }
            else{
                resp = rows[0]['uid'];
                if(err){
                    console.log("err: ", err);
                    res.writeHead(400, "Bad Request", {"Content-Type": "text/html"});
                }
                else if(updated === "UserAlreadyUpdated"){
                    if(resp == last_update){
                        res.writeHead(201, "Already Updated", {"Content-Type": "text/html"});
                        // res.end("User has updated version!")
                    }
                    else{
                        res.writeHead(202, "Server has later version", {"Content-Type": "text/html"});
                        // res.end(resp);
                    }
                }
                else if(updated === "NeedsUpdate"){
                    res.writeHead(202, "Server has later version", {"Content-Type": "text/html"});
                }
                else if(updated === "ServerUpdated"){
                    res.writeHead(200, "Revision updated")
                }
                else{
                    res.writeHead(500, "Internal Server Error");
                }
                res.end(resp);
            }

        });   
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


function createUser(username, publink, pubkey, res){
    db.run('INSERT INTO user VALUES (?,?,?)', username, publink, pubkey, 
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
