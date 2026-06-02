#!/bin/bash
# deploy.sh — push para GitHub e deploy no Netlify
git add -A
git commit -m "${1:-update}"
git push
netlify deploy --prod --dir=.
