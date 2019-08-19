var nodemailer = require('nodemailer');


export async function nodemail(objBody: any) {
  try {
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'jeevan.balla@transerve.com',
        pass: '7989238348'
      }
    });

    var mailOptions = {
      from: 'jeevan.balla@transerve.com',
      to: objBody.email,
      subject: objBody.subject,
      text: objBody.text
    };

    transporter.sendMail(mailOptions, function (error: any, info: any) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

  } catch (err) {
    console.log(err)
    throw err;
  }
}
