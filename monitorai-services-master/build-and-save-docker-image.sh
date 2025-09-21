#!/bin/sh

IMAGE=monitorai-services
VERSION=1.0.0

encore build docker "$IMAGE":"$VERSION"
docker save "$IMAGE":"$VERSION" | gzip > "$IMAGE".tar.gz
