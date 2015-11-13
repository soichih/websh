#DEBUG=profile:* env=dev PORT=12402 nodemon -i node_modules ./index.js

pm2 delete websh
pm2 start websh.js --watch --ignore-watch=".log$ debug .sh$"
pm2 save

#pm2 logs websh
