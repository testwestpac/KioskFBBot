'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const http = require('http')
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var url = require('url');
var formidable = require('formidable');


const app = express()
var a = 1
app.set('port', (process.env.PORT || 5000))

// Allows us to process the data
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// ROUTES

app.get('/', function (req, res) {
    res.send("Hi I am a chatbot")
})

let token = "EAAEOEM6JZAMYBAD9SP1rf7ZCPjz8lzBKjVah4HWmDA8WZBClQSBN8cNJguRams8SsM6ZAlbwpYiVRWjEBVQM5PgZASsAQblv3ZCRAJcTVXoxSmCIRO22tgZB0HuyRSy7rRWMfJeJRjXDxZCI01UKI3AAuZCU4yU2aUDvU4tP9U8WuzQZDZD"

// Facebook 

app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === "Password1") {
        res.send(req.query['hub.challenge'])
    }
    res.send("Wrong token")
})


app.post('/webhook', function (req, res) {
    var data = req.body;
    var BreakException = {};
   
    // Make sure this is a page subscription
    if (data.object === 'page') {
        greetingText();
        //deleteMenu();
        getStarted();
        // Iterate over each entry - there may be multiple if batched
        data.entry.forEach(function (entry) {
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function (event) {
                try {
                    if (event.postback) {
                        
                        receivedPostback(event);
                        throw BreakException;
                    } else {
                        console.log('test')
                        let messageText = event.message.text;
                        let messageAttachments = event.message.attachments;
                        if (messageText) {
                            receivedMessage(event);
                            console.log('text')
                        } else if (messageAttachments) {
                            //console.log(messageAttachments)
                            addUrl(event);
                        }
                        else {
                            console.log("Webhook received unknown event: ", event);
                        }
                    }
                } catch (e) {

                }
            });
        });
        // Assume all went well.

        // You must send back a 200, within 20 seconds, to let us know
        // you've successfully received the callback. Otherwise, the request
        // will time out and we will keep trying to resend.
        res.sendStatus(200);
    }
});

function addUrl(event) {
    var senderID = event.sender.id;
    //lets require/import the mongodb native drivers.
    var mongodb = require('mongodb');
    var assert = require('assert');
    //We need to work with "MongoClient" interface in order to connect to a mongodb server.
    var MongoClient = mongodb.MongoClient;
    // Connection URL. This is where your mongodb server is running.
    //(Focus on This Variable)
    var url = 'mongodb://mlgranado:Password1@ds139082.mlab.com:39082/photoimages';
    var i = 0;
    var messageAttachments = event.message.attachments[i];

    event.message.attachments.forEach(function (value) {
        if (value.type === "image") {
            var insertDocument = function (db, callback) {
                db.collection('images').insertOne({
                    Url: value.payload.url,
                    SenderID: senderID,
                    AccessCode: " "
                }, function (err, result) {
                    assert.equal(err, null);
                    console.log("Inserted a document into the photo collection.");
                    callback();
                });
            };

            MongoClient.connect(url, function (err, db) {
                if (err) {
                    console.log('Unable to connect to the mongoDB server. Error:', err);
                } else {
                    console.log('Connection established to', url);
                    // do some work here with the database.
                    insertDocument(db, function () {
                        //Close connection
                        db.close();
                    });
                }
            });
        }
    });
    promptMorePhotos(senderID);
}

function greetingText() {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
        qs: { access_token: token },
        method: 'POST',
        json: {
            greeting: [
                {
                    locale: "default",
                    text: "Thank you for using the Phone2Prints Upload Assistant. We hope we can make it fun and convenient for you to turn your digital photos into prints you and your loved ones can enjoy!"
                }
            ]
        }
    });
}

function getStarted() {
    var messageData = {
        get_started: {
            payload: "GET_STARTED_PAYLOAD"
        }
    }
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
        qs: { access_token: token },
        method: 'POST',
        json: {
            get_started: {
                payload: "start"
            }
        }
    });
}


function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;
    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);

    console.log(JSON.stringify(message));
    var isBanned = "";
    var messageId = message.mid;
    var messageText = message.text;
    var messageAttachments = message.attachments;
    var Filter = require('bad-words'),
        filter = new Filter();
    if (messageText) {
        // If we receive a text message, check to see if it matches a keyword
        // and send back the example. Otherwise, just echo the text we received.
        isBanned = filter.clean(messageText);
        if (isBanned.indexOf("*") >= 0) {
            //curse word 
            sendTextMessage(senderID, "Sorry to see you're so upset. Our team is working on it");
            getOptions(senderID);
        }
        else {
            sendTextMessage(senderID,"Sorry, I can't help you with that. Please choose an option from the last menu.");
            getOptions(senderID);
        }
    } //else if (messageAttachments) {
    //    sendTextMessage(senderID, "Message with attachment received");
    //}
}

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };
    callSendAPI(messageData);
}

function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
        method: 'POST',
        async: false,
        json: messageData
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;
            console.log("Successfully sent generic message with id %s to recipient %s",
                messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.log(response)
        }
    });
}


function getOptions(recipientId, messageText) {
    
    var userId = recipientId;
    var FBBotFramework = require('fb-bot-framework');
    console.log('FBBotFramework');
    // Initialize 
    var bot = new FBBotFramework({
        page_token: token,
        verify_token: "Password1"
    });
    // Setup Express middleware for /webhook 
    app.use('/webhook', bot.middleware());
    //get name of user
    bot.getUserProfile(userId, function (err, profile) {
        console.log(profile.first_name); // first name of user
        var title = "Hi, " + profile.first_name + "! How can we help you enjoy your memories today?";    
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [{
                            title: title,
                            //subtitle: "",
                            buttons: [{
                                type: "postback",
                                title: "Upload Photos",
                                payload: "UploadPhoto",
                            }, {
                                type: "web_url",
                                url: "https://www.google.com.ph",
                                title: "Find a Kiosk"
                            }, {
                                type: "postback",
                                title: "Learn More",
                                payload: "LearnMore",
                            }],
                        }]
                    }
                }
            }
        };
        callSendAPI(messageData);
    });   
}

function promptPhoto(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "Great! Send me your photos!",
                        //subtitle: "",
                        buttons: [{
                            type: "postback",
                            title: "Cancel",
                            payload: "CancelUpload",
                        }],
                    }]
                }
            }
        }
    };
    callSendAPI(messageData);
}

function uploadOptions(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "What would you like to do?",
                        //subtitle: "",
                        buttons: [{
                            type: "postback",
                            title: "Print a Photo",
                            payload: "PrintPhoto",
                        }, {
                            type: "postback",
                            title: "Make a Collage",
                            payload: "PrintPhoto",
                        }],
                    }]
                }
            }
        }
    };
    callSendAPI(messageData);
}

function promptMorePhotos(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "These are nice pictures. Do you want to upload more?",
                        //subtitle: "",
                        buttons: [{
                            type: "postback",
                            title: "Choose More Photos",
                            payload: "MoreUpload",
                        }, {
                            type: "postback",
                            title: "No",
                            payload: "DoneUpload",
                        }],
                    }]
                }
            }
        }
    };
    callSendAPI(messageData);
}

function sendMorePhotos(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "Okay, send me more photos",
                        //subtitle: "",
                        buttons: [{
                            type: "postback",
                            title: "I'm Done!",
                            payload: "Done",
                        }],
                    }]
                }
            }
        }
    };
    callSendAPI(messageData);
}

function learnMore(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: "Learn More",
                        //subtitle: "",
                        buttons: [{
                            type: "web_url",
                            url: "https://www.google.com.ph",
                            title: "Visit our Website",
                        },{
                            type: "web_url",
                            url: "https://www.messenger.com/t/ChatbotsLife",
                            title: "Send Us a Message"
                        }],
                    }]
                }
            }
        }
    };
    callSendAPI(messageData);
}

function setAccessCode(event) {
    var senderID = event.sender.id;
    var MongoClient = require('mongodb').MongoClient;
    var assert = require('assert');
    var ObjectId = require('mongodb').ObjectID;
    var url = 'mongodb://mlgranado:Password1@ds139082.mlab.com:39082/photoimages';
    var updateRestaurants = function (db, callback) {
        db.collection('images').updateMany(
            { SenderID: senderID, AccessCode: " " },
            {
                $set: { AccessCode: "abc123" }
            }
            ,
            function (err, results) {
                sendTextMessage(senderID, "You have uploaded " + results.modifiedCount + " photos. Your access code is : abc123. Here's a link to help you look for locations (Website). You can use this code until _____");
                callback();
            });
    };
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        updateRestaurants(db, function () {
            db.close();
        });
    });
}

function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;
    // The 'payload' param is a developer-defined field which is set in a postback 
    // button for Structured Messages. 
    var payload = event.postback.payload;
    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);
    // When a postback is called, we'll send a message back to the sender to 
    // let them know it was successful
    if (payload == "start") {
        getOptions(senderID);
    } else if (payload == "UploadPhoto") {
        uploadOptions(senderID);
    } else if (payload == "PrintPhoto") {
        promptPhoto(senderID);
    }else if (payload == "CancelUpload") {
        getOptions(senderID);
    } else if (payload == "MoreUpload") {
        sendTextMessage(senderID, "Okay.Keep 'em coming! ");
        sendMorePhotos(senderID);
    } else if (payload == "Done") {
        setAccessCode(event);
        getOptions(senderID);
    } else if (payload == "DoneUpload") {
        setAccessCode(event);
        getOptions(senderID);
    } else if (payload == "LearnMore") {
        learnMore(senderID);
    } else {
        getOptions(senderID);
    }
}

app.listen(app.get('port'), function () {
    console.log("running: port")
})
