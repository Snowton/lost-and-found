# WW-P: Lost and Found

## Installation Instructions

Run `sudo yum update -y` to warm up. (It's important too! `yum` should be up to date.)

### git

I did `sudo yum install git -y`. Searching it up for your system will give you quick results too.

### nginx

I followed https://jgefroh.medium.com/a-guide-to-using-nginx-for-static-websites-d96a9d034940 and some stackoverflow pages to get through this mess.

#### Installing

If it's an EC2, do `amazon-linux-extras install nginx1` to install nginx.

#### Server files

Go to the nginx directory.

```
cd /etc/nginx
sudo mkdir sites-available
sudo mkdir sites-enabled
```
Create the config files.

```
cd sites-available
sudo touch redirect
sudo touch laf
```

In `redirect`, paste

```
server {
    listen [::]:80 ipv6only=on;
    listen 80;
    
    # if you have a domain:
    server_name <domain> www.<domain>;

    return 301 https://$host$request_uri;
}
```

In `laf`, paste

```
server {
    
    add_header Strict-Transport-Security "max-age=31536000" always;
    client_max_body_size 256M;

    # if you have a domain:
    server_name <domain> www.<domain>;

    location / {
        include proxy_params;
        proxy_pass http://localhost:3000/;
    }
}
```

Then link these two to `sites-enabled`.

```
sudo ln -s /etc/nginx/sites-available/redirect /etc/nginx/sites-enabled/redirect
sudo ln -s /etc/nginx/sites-available/laf /etc/nginx/sites-enabled/laf
```

#### Config files

Go back to the nginx directory--we need to update some files there.

```
cd ..
sudo vi proxy_params
```

Paste:
```
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

(We've included this in `laf`. It will ensure that our reverse proxy works in the next step.)

```
sudo vi nginx.conf
```

You need to paste at least the first line below--it will be under http, but not under server.

```
include /etc/nginx/sites-enabled/*;
# (the below are optional)
access_log /var/log/nginx/access.log;
error_log /var/log/nginx/error.log;
```

Then, we're all set.


#### Run server

All you gotta do is `sudo systemctl start nginx`.

### mongo

Open a config file: `sudo vi /etc/yum.repos.d/mongodb-org-4.4.repo`.

Add this to it:
```
[mongodb-org-4.4]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/4.4/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.4.asc
```

Then:

```
sudo yum install -y mongodb-org
sudo systemctl start mongod
```

### certbot (and epel)

```
sudo amazon-linux-extras install epel -y
sudo yum install certbot -y
```

Then 

```
sudo certbot certonly --debug --standalone -d <domain>
```
Follow instructions.

At the end, you should get some certificates. Now add them to the server files. `/etc/nginx/sites-available/laf` should have something like the following added to it:

```
listen       443 ssl http2;
listen       [::]:443 ssl http2;

ssl_certificate "/etc/pki/nginx/server.crt"; # or pem, or whatever
ssl_certificate_key "/etc/pki/nginx/private/server.key"; # the actual directories/names might be different for certbot

# certbot might already have the following in something like /etc/letsencrypt/options-ssl-nginx.conf
ssl_session_cache shared:SSL:1m;
ssl_ciphers PROFILE=SYSTEM;
ssl_prefer_server_ciphers on;

# certbot might tell you to add some more parameters
```

This is a sketch of what it might look like. I can't configure it right now without an actual domain name.

Then restart the server (`sudo systemctl restart nginx`). You need to do this every time you update configs.

### node

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install node
```

### Clone repo and run!

Choose a folder to hold the repo in. Then: 
```
git clone https://github.com/Snowton/lost-and-found.git
cd lost-and-found
npm i
sudo vi .env
```
Get the API credentials. It should look something like this:
```
CLIENT_ID=[yeah i'm not telling you this]
CLIENT_SECRET=[nope]
CALLBACK=http://<domain>
```
Note that you must add this callback domain to the Google OAuth Credentials (Authorized Redirect URIs).
Then you can happily do:
```
node app.js &
```
  
And you're all set!

## Other

### Server updates 
Remember: to restart the server (or database), do `sudo systemctl restart nginx` (or `mongodb` in the place of `nginx`).

### Site updates
If the site itself needs to be updated, do `git pull origin master` in your repo. It might ask you to give it a merge message.

Then run `ps` to see what the code of the `node` process is, and then kill it with `kill <process number>`. Then you can run `node` in the background again: `node app.js &`.

## Conclusion
When are we getting a docker image?
