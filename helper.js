var request = require('request-promise');

/* TURNING OFF the below hunter request for now for safety*/
// var helper = {
//     collectEmail:function(w){
        // return request(`https://api.hunter.io/v2/domain-search?domain=${w}&api_key=${process.env.HUNTER}&type=generic`)
    //    .then(resp => JSON.parse(resp))
    //    .then(obj => {
    //        console.log('HEREE !',obj.data.emails)
    //     //these emails are in priority order of what is likely most accurate
    //     let toEmail =['events@','info@','privatedining@','contact@','reservations@']
    //     let e1;
    //     let e2;
    //
    //     for (var i=0; i< toEmail.length; i++){
    //         if(e2){
    //             break;
    //         }
    //         obj.data.emails.forEach(email => {
    //             if(e1){
    //                 if(email.value.indexOf(toEmail[i])>=0){
    //                     e2 = email.value
    //                 }
    //             } else {
    //                 if(email.value.indexOf(toEmail[i])>=0){
    //                     e1 = email.value
    //                 }
    //             }
    //         })
    //     }
    //     return [e1, e2]
    //     })
    // }
// }
//
// module.exports = {
//  helper: helper
// };
