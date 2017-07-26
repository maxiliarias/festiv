var request = require('request-promise');
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);

/* TURNING OFF the below hunter request for now for safety*/
var helper = {
    collectEmail:function(w){
        return request(`https://api.hunter.io/v2/domain-search?domain=${w}&api_key=${process.env.HUNTER}&type=generic`)
       .then(resp => JSON.parse(resp))
       .then(obj => {
           console.log('HEREE !',obj.data.emails)
        //these emails are in priority order of what is likely most accurate
        let toEmail =['events@','info@','privatedining@','contact@','reservations@']
        let e1;
        let e2;

        for (var i=0; i< toEmail.length; i++){
            if(e2){
                break;
            }
            obj.data.emails.forEach(email => {
                if(e1){
                    if(email.value.indexOf(toEmail[i])>=0){
                        e2 = email.value
                    }
                } else {
                    if(email.value.indexOf(toEmail[i])>=0){
                        e1 = email.value
                    }
                }
            })
        }
        return [e1, e2]
        })
    },
    sendMail: function(req, venue){
        var b = {
                personalizations: [{
                    'substitutions': {
                        '-businessName-':venue.name,
                        '-fname-':req.user.fname,
                        '-date-':req.body.date,
                        '-starttime-':req.body.starttime,
                        '-guestCount-':req.body.guestCount,
                        '-price-':req.body.price,
                        '-hours-':req.body.hours,
                    },
                    custom_args: {
                        "venueid":venue._id
                    }
                }],
                from: {
                    email: req.user.fname + '@hello.festivspaces.com',
                    name: req.user.fname + ' (Festiv)'
                },
                reply_to:{
                    email: 'id'+ venue._id + '@reply.festivspaces.com',
                    name: req.user.fname + ' (Festiv)'
                },
                template_id: process.env.TEMPLATE_ID_QUOTE
            }

        if(venue.email[1]){
            b.personalizations[0].to = [{email: venue.email[0]}]
            b.personalizations[0].cc = [{email: venue.email[1]}]
        } else if (venue.email[0]){
            b.personalizations[0].to = [{email: venue.email[0]}]
        } else {
            b.personalizations[0].to=[{email: 'maxiliarias@gmail.com'}]
            b.personalizations[0].substitutions['-placeid-']= venue.placeId
            b.template_id= process.env.TEMPLATE_ID_NO_EMAIL
        }

        //SEND THE EMAIL
        var request = sg.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: b
        });
        sg.API(request, function(error, response) {
            if (error) {
                console.log('Error response received');
            }
            console.log('STATUS HERE' ,response.statusCode);
            console.log('BODY HERE', response.body);
            console.log('HEADERS HERE', response.headers);
        });
    }
}

module.exports = {
 helper: helper
};
