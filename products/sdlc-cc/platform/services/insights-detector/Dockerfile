FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .
COPY app ./app
COPY rules ./rules
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
