# NotFlix

## Introduction

Notflix is a simple and easy to set up video watching server platform.

## Setup

Setup Steps
1. Install MongoDB Community Server at https://www.mongodb.com/try/download/community:
2. Clone repository onto machine
3. If you do not have npm installed, install it, you can check your version with "npm -v"
4. Install dependencies by running npm install
5. Create MongoDB database called "Notflix"
6. Create two MongoDB collections in database called "movies" and "fortnite"
7. In local repository run "node .\app.js"

## Usage

Connect to the website via port 5000

Accounts are separated into three user types

* "user": default permission, allowed to enter website and view videos
* "marketing": user permissions as well as the ability to see view counts on video watch pages
* "editor": user permissions as well as the ability to upload content from the browsing page and can edit and delete videos on their watch pages

Account permissions can be modified by setting their accountType variable to the previous settings inside the database manually

