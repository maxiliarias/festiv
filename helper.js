var request = require('request-promise');
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);

/* TURNING OFF the below hunter request for now for safety*/
var helper = {
    generateGooglePhotos:function(data) {
        if (!data) {
            return '';
        }
        return 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + data + '&key=' + process.env.GOOGLEPLACES;
    },
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
                if(email.value.indexOf(toEmail[i])>=0){
                    if(e1){
                        e2 = email.value
                    } else {
                        e1 = email.value
                    }
                }
            })
        }
        return [e1, e2]
        })
    },
    sendMail: function(req, match, venue, fname){
        console.log('FNAME IS ', fname)
        var b = {
                personalizations: [{
                    'substitutions': {
                        '-businessName-':match.name,
                        '-fname-':fname,
                        '-date-':req.body.date,
                        '-starttime-':req.body.time,
                        '-guestCount-':req.body.guestCount,
                        '-price-':req.body.price,
                        '-hours-':req.body.hours,
                        '-additional-': req.body.more ? "Additional Details: " + req.body.more : ""
                    },
                    custom_args: {
                        "vEventid": venue._id,
                        "vDataid": match._id
                    },
                    "bcc": [{
                        "email": "hello@festivspaces.com"
                    }]
                }],
                from: {
                    email: fname + '@hello.festivspaces.com',
                    name: fname + ' (Festiv)'
                },
                reply_to:{
                    email: 'id'+ venue._id + '@reply.festivspaces.com',
                    name: fname + ' (Festiv)'
                },
                template_id: process.env.TEMPLATE_ID_QUOTE
            }

        if(match.email[1]){
            b.personalizations[0].to = [{email: match.email[0]}]
            b.personalizations[0].cc = [{email: match.email[1]}]
        } else if (match.email[0]){
            b.personalizations[0].to = [{email: match.email[0]}]
        } else {
            b.personalizations[0].to=[{email: 'maxiliarias@gmail.com'}]
            b.personalizations[0].substitutions['-placeid-']= match.placeId
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
    },
    formatDate:function(input){
        date= new Date(input)
        year = date.getFullYear();
        month = date.getMonth()+1;
        dt = date.getDate();
        if (dt < 10) {
          dt = '0' + dt;
        }
        if (month < 10) {
          month = '0' + month;
        }
        return (month + "-" + dt + "-" + year)
    }
}

module.exports = {
 helper: helper
};
