E#!/bin/bash
if [ -z $1 ]
    then
        environment=dev
else
    environment=$1
fi

builddir="cmp-api-service-$environment"
pm2process="$environment-cmp-api-service"
zipname="$builddir.zip"
sshconfig="cmp-$environment"
nodebin=/home/ubuntu/.nvm/versions/node/v10.16.3/bin

echo "Remove dist folder"
rm -rf $builddir $zipname
echo "Removed dist build directory successfully"

echo "Started typescript compiling"
./node_modules/.bin/tsc -p tsconfig.json --outDir $builddir --sourceMap false
cp package.json package-lock.json openapi.yaml swagger.yaml compiled-swagger.yaml $builddir
cp utils/roles.json utils/capabilities.json utils/default_permissions.json utils/rbac.json utils/country_codes.json utils/email_template.json utils/sms_template.json utils/system_config.json  utils/cities.json $builddir/utils

echo "Creating a zip to be exported"
zip -qr $zipname $builddir
echo "Compressed build directory for deployment"

echo "Copying file to remote for deployment"
scp $zipname $sshconfig:~/src

echo "Deploying application"
ssh $sshconfig "export PATH=$nodebin:\$PATH; pm2 stop $pm2process"
ssh $sshconfig "rm -rf $builddir"
ssh $sshconfig "unzip -q src/$zipname"

ssh $sshconfig "export PATH=$nodebin:\$PATH; cd ~/$builddir; npm i"
ssh $sshconfig "export PATH=$nodebin:\$PATH; pm2 start $pm2process;"
echo "Deployed successfully"
