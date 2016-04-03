var APP_KEY = "rwovrjf7g18ya3b";

//create team:
	//Make team folder on the cloud. Populate with keys.
//Add teammates:
	//Create keys for teammate.

var fileName="";
// var team_select 
var selected_team;
var selected_user;
var encrypted_privkey;
var access_token = "";
var combo = "";
var selected_team_data;
var selected_team_tasks = [];
var self_user;
var teammate_TLDLinks;
var data_version;
var changes_made = false;

document.getElementById("team_create").onclick = handleTeamCreate;
document.getElementById('teammate_add').onclick = handleTeammateAdd;
document.getElementById('save_data').onclick = handleSaveData;
document.getElementById('add_data_btn').onclick = addToTasks;
document.getElementById('get_teammate_db').onclick = getTeammateDB;
document.getElementById('done_btn').onclick = handleTaskDone;


var text_field = document.getElementById('text_data');
var task_list = document.getElementById('task_data');

var team_list = document.getElementById("team_list");
team_list.onchange = handleTeamSelect;
task_list.onchange = handleTaskSelect;

var username_field = document.getElementById('teammate_name');

var userSalt = sessionStorage.getItem('userSalt');

window.onload = checkAuth;

function parseqs(text){
	var split = text.split('&');
	var params = {};
	for(var i=0; i<split.length; i++){
		var kv = split[i].split('=',2);
		params[kv[0]] = kv[1];
	}
	return params;
}

function addToTasks(){
	console.log(task_to_add);
	var task_to_add = document.getElementById('add_value').value;

	selected_team_tasks.push({"Pending": task_to_add});
	selected_team_data['data'].push({"ADD": task_to_add});

	changes_made = true;

	showTasks();
}

function handleTaskSelect(evt){
	var done_btn = document.getElementById('done_btn');	
	var pending_boxes = document.getElementsByName("pending_boxes");

	for(var i = 0; pending_boxes[i]; i++){
		done_btn.style.display = 'none';
		if(pending_boxes[i].checked){
			console.log(pending_boxes[i].value + " checked");
			done_btn.style.display = 'block';
			break;
		}
	}
}

function handleTaskDone(evt){
	var pending_boxes = document.getElementsByName("pending_boxes");
	console.log("Tasks before: ", selected_team_tasks);
	for(var i = 0; i < pending_boxes.length; i++){
		if(pending_boxes[i].checked){	
			var task_to_remove = pending_boxes[i].value;
			selected_team_data['data'].push({"COMPLETE": task_to_remove});

			for(var j = 0; j < selected_team_tasks.length; j++){
				console.log(selected_team_tasks[j]["Pending"]);
				if(selected_team_tasks[j]["Pending"] && selected_team_tasks[j]["Pending"] === task_to_remove){
					console.log("Spliced!")
					selected_team_tasks.splice(j, 1);
				}
			}
			selected_team_tasks.push({"Completed": task_to_remove});
		}
	}
	console.log("Tasks after: ", selected_team_tasks);
	showTasks();
}

function checkAuth(evt){
	if(!sessionStorage.getItem('access_token')){
		alert("Please log in again");
	}

	else{
		access_token = sessionStorage.getItem('access_token');
		combo = sessionStorage.getItem('combo');
		self_user = sessionStorage.getItem('self_user');
		setLoggedUser();
		getTeamList();
		getPrivKey();
	}
}

function setLoggedUser(){
	var text = document.getElementById('logged_user');
	text.innerHTML = "Logged in as: "+self_user;

}

function getPrivKey(){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onPrivKeyRx, false);
	xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/privKey", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function onPrivKeyRx(){
	encrypted_privkey = this.responseText;
	// sessionStorage.setItem('encrypted_privkey', encrypted_privkey);
	// var pbkd = forge.pkcs5.pbkdf2(sessionStorage.getItem('combo'), userSalt, 40, 16);
	// var privKey = forge.pki.decryptRsaPrivateKey(encrypted_privkey, pbkd);	
}

function get_redirect_uri(){
	return "http://localhost:8080/Prototype.html";
}

function handleTeammateAdd(evt){
	var username = username_field.value;
	checkUserDB(username, onUserStatusRx);

}

function handleSaveData(evt){
	saveData();
}

function saveData(){
	if(changes_made = true){
		selected_team_data['data'][3]['VERSION']++;
		var team_data = JSON.stringify(selected_team_data);

		var data = forge.util.createBuffer(team_data);
		var iv = "0000000000000000"

		var userTeamKey = sessionStorage.getItem(selected_team+'_userTeamKey')
		console.log('userteamkey: ', userTeamKey);
		var data_cipher = forge.aes.startEncrypting(userTeamKey, iv);

		data_cipher.update(data);

		var status = data_cipher.finish();

		var encrypted_data = data_cipher.output.data;

		updateTeamVersion(selected_team_data['data'][1]['TEAM_UID'], selected_team_data['data'][3]['VERSION']);
		fileUploadRequest(encrypted_data, selected_team+'/data', onTeamDataUpload);
	}
}

//Get list of teams
function getTeamList(){
	var xmlhttp = new XMLHttpRequest();
	var data = {path: ""}
	var requestData = JSON.stringify(data);

	xmlhttp.addEventListener('load', onTeamListRx, false);

	xmlhttp.open('POST', 'https://api.dropboxapi.com/2/files/list_folder', true);
	xmlhttp.setRequestHeader('Authorization', ' Bearer '+access_token);
	xmlhttp.setRequestHeader('Content-Type', ' application/json ');
	xmlhttp.send(requestData)
}

//Parse team list
function onTeamListRx(){
	var response = JSON.parse(this.responseText);
	var team_list = [];
	var list = response['entries'];
	
	for(var i = 0; i<list.length; i++){
		if(list[i]['.tag'] === 'folder'){
			team_list.push(list[i]['name']);
		}
	}

	populateTeamSelect(team_list);
}

//Populate team selection dropdown
function populateTeamSelect(list){
	// team_select = document.getElementById('team_list');
	// team_select.innerHTML = ' ';
	var data = ""
	for(var i = 0; i<list.length; i++){
		var option = document.createElement("option");
		option.text = list[i];
		team_list.appendChild(option)
	}
	if(team_list.options.length >= 1){
		team_list.options.selectedIndex = 0;
		handleTeamSelect();
	}
	//team_select.innerHTML(data);
}

function handleTeamSelect(evt){
	selected_team = team_list.options[team_list.selectedIndex].text;
	var body = document.getElementById('team_selected');
	selected_team_tasks.length = 0;
	selected_team_data = null;


	body.innerHTML = "";

	body.innerHTML = "Selected Team: "+ selected_team+"<br>";

	getTeamSalt(selected_team);
}

function getTeamSalt(team_name){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.team_name = team_name;
	xmlhttp.addEventListener('load', onTeamSaltRx, false)

	xmlhttp.open('GET', "https://content.dropboxapi.com/1/files/auto/"+team_name+"/team_salt", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function onTeamSaltRx(){
	var encrypted_teamsalt = this.responseText;

	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var iv = "0000000000000000";

	var team_salt = forge.aes.startDecrypting(pbkd, iv);

	var new_buffer = forge.util.createBuffer(encrypted_teamsalt);

	team_salt.update(new_buffer);

	var status = team_salt.finish();

	var plaintext = team_salt.output.data;
	var actual_salt = plaintext.split('team_salt: ')[1];


	sessionStorage.setItem(this.team_name+'_salt', actual_salt);


	makeDownloadRequest("/"+this.team_name+'/data', onTeamDataRx);

}

function onTeamDataRx(){
	var encrypted_data = this.responseText;
	var team_name = selected_team;
	
	var team_salt = sessionStorage.getItem(team_name+'_salt');
	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var userTeamKey = forge.pkcs5.pbkdf2(encrypted_privkey, team_salt, 40, 16);
	sessionStorage.setItem(team_name+'_userTeamKey', userTeamKey);

	console.log(userTeamKey)
	var iv = "0000000000000000";
	var data = forge.aes.startDecrypting(userTeamKey, iv);
 	var new_buffer = forge.util.createBuffer(encrypted_data);   
   	data.update(new_buffer);  
   	var status = data.finish();
   	var plain_data = data.output.data;
   	console.log(plain_data);
   	var data = JSON.parse(plain_data);

   	selected_team_data = data;

   	sessionStorage.setItem(team_name+'_data', selected_team_data);
   	
   	console.log(selected_team_data);

   	// text_field.value = data['data'];


   	//populateTeammateList(selected_team_data);
   	parseData(data['data']);
}

function parseData(data_array){
	var teammate_list = [];
	console.log(data_array);
	for(var i=0; i<data_array.length; i++){
		for(var key in data_array[i]){
			var value = data_array[i][key];
			if(key === "ADD"){
				var task = {"Pending": value};

				selected_team_tasks.push(task);
			}
			else if(key === "COMPLETE"){
				var task = {"Completed": value};
				for(var j = 0; j < selected_team_tasks.length; j++){
					if(selected_team_tasks[j]["Pending"] && selected_team_tasks[j]["Pending"] === value){
						selected_team_tasks.splice(j, 1)
					}
				}
				selected_team_tasks.push(task);
			}
			//Will be an object with "{username: teammate_uuid}"
			else if(key === "OWNER" || key === "ADD_TEAMMATE"){
				teammate_list.push(value);
			}
			else if(key === "VERSION"){
				data_version = value;
			}
		}
	}
	populateTeammateList(teammate_list);
	console.log(selected_team_tasks);
	showTasks();
}

function showTasks(){
	task_list.innerHTML = "";

	var pending_node = document.createTextNode("Pending");
	var completed_node = document.createTextNode("Completed")

	task_list.appendChild(pending_node);
	task_list.appendChild(document.createElement("br"));

	var completed_list = document.createElement("ul");

	for(var i = 0; i < selected_team_tasks.length; i++){
		for(var key in selected_team_tasks[i]){
			if(key === "Pending"){
				var checkbox = document.createElement("input");
				var pair = selected_team_tasks[i][key];
				checkbox.type = "checkbox";
				checkbox.name = pair;
				checkbox.value = pair;
				checkbox.name = "pending_boxes";
				task_list.appendChild(checkbox);

				var label = document.createElement('label')
				label.htmlFor = pair;
				label.appendChild(document.createTextNode(pair));

				task_list.appendChild(label);
				task_list.appendChild(document.createElement("br"));
			}
			else if(key === "Completed"){
				var item = document.createElement('li');
				item.appendChild(document.createTextNode(selected_team_tasks[i][key]));
				completed_list.appendChild(item);
			}
		}

		task_list.appendChild(completed_node);
		task_list.appendChild(completed_list);
	}
}


function populateTeammateList(data){
	var teammate_list = document.getElementById('teammate_list')
	teammate_list.innerHTML = "";

	var list = document.createElement('ul');
	console.log("populateTeammateList: " + data);
	for(var i = 1; i < data.length; i++){
		var item = document.createElement('li');
		item.appendChild(document.createTextNode(data[i]));
		list.appendChild(item);
	}

	teammate_list.appendChild(list);
}

//Get teammate publink from CS, get their team_links, find same team, look for self_user in team_name/links
function getTeammateDB(){
	var teammate_uid = member_list[1];
	checkUserDB(teammate_uid, onTLDLinkRx)

}

function onTLDLinkRx(){
	var json = JSON.parse(this.responseText);
	var TLDLink = json[0].publink;
	console.log('TLDLINK', TLDLink);

	downloadFile(TLDLink, onTLDFileRx)
}

function onTLDFileRx(){
	var resp = this.responseText;
	teammate_TLDLinks = resp.split('\n');
	console.log('teammate_tldlinks', teammate_TLDLinks)

	var teamlinks_publink = teammate_TLDLinks[3];

	console.log('teamlinks_publink', teamlinks_publink);
	downloadFile(teamlinks_publink, onTeammateTeamlinksRx);

}

function onTeammateTeamlinksRx(){
	var resp = this.responseText;
	var teammate_teamlinks = resp.split('\n')
	console.log("selected team: ", selected_team);
	
	for(var i = 0; i < teammate_teamlinks.length; i++){
		var team_info = teammate_teamlinks[i];
		console.log(team_info.indexOf(selected_team));
		if (team_info.indexOf(selected_team)>=0){
			var teammate_teampublink = team_info.split(selected_team+": ")[1];
			console.log(teammate_teampublink);
			console.log("Getting self key from teammate");
			downloadFile(teammate_teampublink, onTeammateTeamKeyLinksRx);
		}
	}
}

function onTeammateTeamKeyLinksRx(){
	var resp = this.responseText;
	console.log(resp);
	var teammate_links = resp.split('\n');
	var data = {key: null, data: null};
	for(var i = 0; i < (teammate_links.length-1); i++){
		var temp = teammate_links[i];

		if(temp.indexOf(self_user) >= 0){
			var self_teammatekeylink = temp.split(self_user+': ')[1];
			console.log('data', data);
			downloadFile(self_teammatekeylink, onTeammateDataKeyRx, data);
		}
		else if(temp.indexOf('Data: ' >= 0)){
			var teammateData_link = temp.split('Data: ')[1];
			console.log('data', data);
			downloadFile(teammateData_link, onTeammateDataRx, data);
			console.log("Nothing")
		}		
	}
}

function onTeammateDataRx(){
	this.param.data = this.responseText;
	decryptTeammateData(this.param);
}

function onTeammateDataKeyRx(){
	var encrypted_teammateDataKey = this.responseText;
	var combo = sessionStorage.getItem('combo');
	console.log('combo', combo);
	console.log('salt', userSalt);
	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);
	console.log('pbkd', pbkd);
	console.log('pbkd type', typeof(pbkd));
	console.log('enc_key', encrypted_privkey)
	var encrypted_keyinfo = forge.pki.encryptedPrivateKeyFromPem(encrypted_privkey)

	console.log('foo', encrypted_keyinfo);
	var decrypted_privKey = forge.pki.decryptRsaPrivateKey(encrypted_privkey, pbkd);

	var encoded_decrypted_teammateDataKey = decrypted_privKey.decrypt(encrypted_teammateDataKey);
	var decoded_decrypted_teammateDataKey = atob(encoded_decrypted_teammateDataKey);
	console.log("decoded_decrypted_teammatedatakey", decoded_decrypted_teammateDataKey);
	this.param.key = decoded_decrypted_teammateDataKey;


	decryptTeammateData(this.param);
}

function decryptTeammateData(param){
	if(param.key === null || param.data === null){
		return
	}
	console.log(param);
	var iv = "0000000000000000";
	var data = forge.aes.startDecrypting(param.key, iv);
 	var new_buffer = forge.util.createBuffer(param.data);   
   	data.update(new_buffer);  
   	var status = data.finish();
   	var plain_data = data.output.data;
   	console.log(plain_data);
}

function handleTeamCreate(e){
	var team_name = document.getElementById('team_name').value;
	selected_team = team_name;

	createTeamFolder(team_name);

}


//Create team folder
function createTeamFolder(team_name){
	var xmlhttp = new XMLHttpRequest();
	var data = team_name+'/Keys'

	xmlhttp.addEventListener('load', onTeamFolderCreate, false);

	xmlhttp.open('POST', 'https://api.dropboxapi.com/1/fileops/create_folder?root=auto&path='+data, true);
	xmlhttp.setRequestHeader('Authorization', ' Bearer '+access_token);
	xmlhttp.send();
}

//Create and upload team salt
function onTeamFolderCreate(){
	//Once folder is created make salt and upload it to the folder.
	var folder_metadata = JSON.parse(this.responseText);
	var path = folder_metadata.path;
	var team_name = path.split('/')[1];
	console.log('Folder created: ' + team_name);

	var team_salt = forge.random.getBytesSync(128);

	var uteam_salt = forge.util.createBuffer("team_salt: "+team_salt);

	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);


	var iv = "0000000000000000";

	var team_salt_cipher = forge.aes.startEncrypting(pbkd, iv);
	team_salt_cipher.update(uteam_salt);
	var status = team_salt_cipher.finish();

	var encrypted_team_salt = team_salt_cipher.output.data;

	fileUploadRequest(encrypted_team_salt, team_name+"/team_salt", teamSaltCallback);
	fileUploadRequest("", team_name+"/links", getTeamDirPublink);

	sessionStorage.setItem(team_name+"_salt", team_salt);

	makeUserTeamKey(team_salt, team_name);

}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function initializeEncryptedDB(team_name){
	var team_uuid = guid();
	console.log(team_uuid);
	var team_data = JSON.stringify({'data': [{'CREATED': team_name}, {'TEAM_UID': team_uuid}, {'OWNER': self_user}, {'VERSION': '1'}]});
	var data = forge.util.createBuffer(team_data);
	var iv = "0000000000000000"

	var userTeamKey = sessionStorage.getItem(team_name+'_userTeamKey')

	var data_cipher = forge.aes.startEncrypting(userTeamKey, iv);

	data_cipher.update(data);

	var status = data_cipher.finish();

	var encrypted_data = data_cipher.output.data;

	updateTeamVersion(team_uuid, 1);
	console.log('Uploading encrypted data');
	fileUploadRequest(encrypted_data, team_name+'/data', onTeamDataInitialize);
}

function updateTeamVersion(team_uuid, version_number){
	var params = "team_uuid="+encodeURIComponent(team_uuid)+"&version_number="+encodeURIComponent(version_number)+"&user="+encodeURIComponent(self_user);

	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onVersionUpdate, false);

	xmlhttp.open("POST", "/teamversion", true);
	xmlhttp.send(params);
}

function onVersionUpdate(){
	console.log(this);
	return;
}

function onTeamDataInitialize(){
	var resp = JSON.parse(this.responseText);
	var path = resp['path'];

	getPubLink(path, updateTeamKeyLinks, onTeamDataLinkRx)
}

function onTeamDataUpload(){
	if(this.status == 200){
		console.log("data file uploaded")
	}
}

function onTeamDataLinkRx(){
	var resp = this.responseText
	var link_update = resp.concat("Data: "+this.publink+"\n");
	var path = this.path;
	var team_name = path.split('/')[1]

	fileUploadRequest(link_update, team_name+"/links", onTeamDataLinkUpdate);

}

function onTeamDataLinkUpdate(){
	console.log("Team data link updated")

}

//Create User Key for team data
function makeUserTeamKey(team_salt, team_name){
	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var userTeamKey = forge.pkcs5.pbkdf2(encrypted_privkey, team_salt, 40, 16);
	sessionStorage.setItem(team_name+'_userTeamKey', userTeamKey);

	console.log("userTeamKey created: "+ team_name);

	initializeEncryptedDB(team_name);

}

function fileUploadRequest(requestData, path, callback){

	var xmlhttp = new XMLHttpRequest();
	var team_name = path.split('/')[1]
	xmlhttp.addEventListener("load", callback, false)

	xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+path+"?overwrite=true", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(requestData);
}

function teamSaltCallback(){
	return; 
}

function getTeamDirPublink(){
	if(this.status == 200){
		var resp = JSON.parse(this.responseText);
		var path = resp['path'];
		var team_name = path.split('/')[1]

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.team_name = team_name;

		xmlhttp.addEventListener('load', onTeamDirPublinkRx, false);

		xmlhttp.open('POST', "https://api.dropbox.com/1/shares/auto"+path+"?short_url=false", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
		// updateTeamLinks(path);
	} 
}

function onTeamDirPublinkRx(){
	var resp = JSON.parse(this.responseText);
	var team_publink = resp.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");

	var xmlhttp = new XMLHttpRequest();
	xmlhttp.team_publink = team_publink;
	xmlhttp.team_name = this.team_name;

	xmlhttp.addEventListener('load', onTeamLinksRx, false);

	xmlhttp.open('GET', "https://content.dropboxapi.com/1/files/auto/team_links", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);

}

function onTeamLinksRx(){
	var resp = this.responseText;

	var team_links_list = resp.split('\n');

	console.log(team_links_list);

	for(var i = 0; i < team_links_list.length; i++){
		var team_info = team_links_list[i];
		console.log(team_info.indexOf(this.team_name));
		if (team_info.indexOf(this.team_name)>=0){
			team_links_list.splice(i, 1);
			console.log(team_links_list);
		}
	}

	var link_update = this.team_name+": "+this.team_publink;

	team_links_list.push(link_update);

	var list_string = team_links_list.toString();

	var links_string = list_string.replace(/,/g, '\n');

	fileUploadRequest(links_string, "/team_links", onTeamLinksUpdate);
	
}

function onTeamLinksUpdate(){
	if (this.status == 200){
		console.log('Team links updated');
	}
	else{
		console.log("Something went wrong")
	}
}

function makeDownloadRequest(filename, cb){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.addEventListener('load', cb, false);

	xmlhttp.open("GET", "https://content.dropboxapi.com/2/files/download", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.setRequestHeader("Dropbox-API-Arg", " {\"path\": \""+filename+"\"}")
	xmlhttp.send(null);

}

function checkUserDB(teammate_name, cb){
	var xmlhttp = new XMLHttpRequest();
	var post_data = "uid="+encodeURIComponent(teammate_name);

	xmlhttp.addEventListener('load', cb, false);
	// xmlhttp.teammate_name = teammate_name;

	xmlhttp.open('POST', 'user', true);
	xmlhttp.send(post_data)
}

function onUserStatusRx(){
	//Get uid from here to 
	var body = document.getElementById('user_selected');

	body.innerHTML = "";

	if(this.status==200){
		var resp = JSON.parse(this.responseText)
		selected_user = resp[0]['uid'];

		body.innerHTML = "Selected User: "+resp[0]['uid']+"<br>";
		
		var user_publink = resp[0]['publink']
		console.log('onuserstatusrx');
		downloadFile(user_publink,  userPublinkCB);
		// var team_name = resp[0]['uid']
	}
	else{
		body.innerHTML = "Selected User: NOT FOUND"
	}
}

function userPublinkCB(){
	var resp = this.responseText;
	console.log('resp', resp);  
	var user_pubKeylink = resp.split('\n')[0]
	console.log("userPublinkCB")
	downloadFile(user_pubKeylink, userPubKeyCB);
}


function userPubKeyCB(){
	var pem = this.responseText;
	var teammate_pubKey = forge.pki.publicKeyFromPem(pem);

	makeTeammateKey(teammate_pubKey);

}

//https://github.com/digitalbazaar/forge/issues/274
function makeTeammateKey(teammate_pubkey){
	var userTeamKey = sessionStorage.getItem(selected_team+"_userTeamKey");
	var encoded_teamkey = btoa(userTeamKey);

	var encrypted_userTeamKey = teammate_pubkey.encrypt(encoded_teamkey);
	console.log('Key for '+selected_user+' created');

	uploadTeammateKey(encrypted_userTeamKey);
}


function uploadTeammateKey(encrypted_userTeamKey){
	fileUploadRequest(encrypted_userTeamKey, selected_team+'/Keys/'+selected_user, getTeammateKeyPublink);

}

function getTeammateKeyPublink(){
	if(this.status == 200){
		console.log(selected_user + " added to "+ selected_team);
		var resp = JSON.parse(this.responseText);
		var path = resp['path'];

		getPubLink(path, updateTeamKeyLinks, onTeammateLinksRx);
	} 
}

function updateTeamKeyLinks(){
	if(this.status == 200){
		var resp = JSON.parse(this.responseText);
		var publink = resp.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.publink = publink;
		xmlhttp.path = this.path;

		xmlhttp.addEventListener('load', this.callback, false);

		xmlhttp.open('GET', "https://content.dropboxapi.com/1/files/auto/"+selected_team+"/links", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
	}

}

function onTeammateLinksRx(){
	var resp = this.responseText
	var link_update = resp.concat(selected_user+": "+this.publink+"\n");

	fileUploadRequest(link_update, selected_team+"/links", updateMemberData);
}


function updateMemberData(){
	// console.log(selected_team_data);
	selected_team_data['data'].push({'ADD_TEAMMATE': selected_user});
	console.log("team_data updated");
	changes_made = true;

	saveData();
}


function downloadFile(download_url, cb, param){
	var xmlhttp = new XMLHttpRequest();
	if(!(typeof(param) === 'undefined')){
		xmlhttp.param = param;
	}

	xmlhttp.addEventListener('load', cb, false);

	console.log('download url', download_url)

	xmlhttp.open("GET", download_url, true);
	xmlhttp.send(null)
}

function getPubLink(path, cb, cb2){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', cb, false);
	xmlhttp.callback = cb2;
	xmlhttp.path = path;

	xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+path+"?short_url=false",true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}
