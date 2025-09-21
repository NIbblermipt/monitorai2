#!/bin/sh

IMAGE=monitorai-web
VERSION=1.0.0

docker build -t "$IMAGE":"$VERSION" . --load
docker save "$IMAGE":"$VERSION" | gzip > "$IMAGE".tar.gz
