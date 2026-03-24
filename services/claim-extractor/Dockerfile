FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /claim-extractor ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=builder /claim-extractor /claim-extractor
EXPOSE 8080
ENTRYPOINT ["/claim-extractor"]
