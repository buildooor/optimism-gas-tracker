build:
	npm run build

start:
	./bin/server server

.PHONY: test
test:
	npx jest test/controller.test.ts

docker-build:
	docker build --build-arg=GIT_REV=$$(git rev-parse --short HEAD) -f Dockerfile -t buildooor/backend .

docker-stop:
	docker stop optimism-gas-tracker; docker kill optimism-gas-tracker; docker rm optimism-gas-tracker;

docker-start:
	docker run -d --net=host --name=optimism-gas-tracker -v /tmp/db:/tmp/db --restart=unless-stopped --log-driver local --log-opt max-size=2gb --env-file .env -p 8000:8000 buildooor/backend

postgres-start:
	docker run -d --net=host --rm --name pg -p 5432:5432 -v ./postgres_data:/var/lib/postgresql/data -e POSTGRES_PASSWORD=$(PG_PASS) postgres
