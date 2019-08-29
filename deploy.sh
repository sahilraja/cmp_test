#!/bin/bash
builddir=cmp-api-service-build
zipname=cmp-api-service-build.zip
sshconfig=cmp
nodebin=/home/ubuntu/.nvm/versions/node/v10.16.3/bin

echo "Remove dist folder"
rm -rf $builddir
echo "Removed dist build directory successfully"

echo "Started typescript compiling"
./node_modules/.bin/tsc -p tsconfig.json --outDir $builddir --sourceMap false
cp package.json package-lock.json openapi.yaml $builddir
cp policy/rbac.json $builddir/utils

echo "Creating a zip to be exported"
zip -r $zipname $builddir
echo "Compressed build directory for deployment"

echo "Copying file to remote for deployment"
scp $zipname $sshconfig:~/src

echo "Deploying application"
ssh $sshconfig "export PATH=$nodebin:\$PATH; pm2 stop $builddir"
ssh $sshconfig "rm -rf $builddir"
ssh $sshconfig "unzip src/$zipname"

ssh $sshconfig "export PATH=$nodebin:\$PATH; cd ~/$builddir; npm i"
ssh $sshconfig "export PATH=$nodebin:\$PATH; pm2 start $builddir;"
echo "Deployed successfully"
