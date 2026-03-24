FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /source-evaluator ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=builder /source-evaluator /source-evaluator
EXPOSE 8080
ENTRYPOINT ["/source-evaluator"]
