"""
Streaming utilities for SDLC.ai SDK

Provides support for streaming downloads and uploads.
"""

import asyncio
from collections.abc import AsyncIterator, Iterator
from typing import BinaryIO, Callable, Optional, Union

import structlog

logger = structlog.get_logger("sdlc_sdk.streaming")


class StreamProgress:
    """Progress tracker for streaming operations."""

    def __init__(
        self,
        total_size: Optional[int] = None,
        on_progress: Optional[Callable[[int, Optional[int]], None]] = None,
    ):
        self.total_size = total_size
        self.bytes_transferred = 0
        self.on_progress = on_progress
        self._start_time = None
        self._last_update_time = None

    def update(self, chunk_size: int) -> None:
        """Update progress."""
        self.bytes_transferred += chunk_size

        if self.on_progress:
            # Call progress callback
            self.on_progress(self.bytes_transferred, self.total_size)

    def get_progress_percent(self) -> Optional[float]:
        """Get progress as percentage."""
        if self.total_size is None:
            return None
        return (
            (self.bytes_transferred / self.total_size) * 100
            if self.total_size > 0
            else 0.0
        )


def stream_download(
    response,
    chunk_size: int = 8192,
    on_progress: Optional[Callable[[int, Optional[int]], None]] = None,
) -> Iterator[bytes]:
    """
    Stream download from HTTP response.

    Args:
        response: HTTP response object
        chunk_size: Size of chunks to read
        on_progress: Progress callback function

    Yields:
        Chunks of data
    """
    content_length = response.headers.get("content-length")
    total_size = int(content_length) if content_length else None

    progress = StreamProgress(total_size=total_size, on_progress=on_progress)

    try:
        for chunk in response.iter_bytes(chunk_size=chunk_size):
            if chunk:
                progress.update(len(chunk))
                yield chunk
    except Exception as e:
        logger.error(
            "Stream download error",
            error=str(e),
            bytes_transferred=progress.bytes_transferred,
        )
        raise


async def async_stream_download(
    response,
    chunk_size: int = 8192,
    on_progress: Optional[Callable[[int, Optional[int]], None]] = None,
) -> AsyncIterator[bytes]:
    """
    Async stream download from HTTP response.

    Args:
        response: Async HTTP response object
        chunk_size: Size of chunks to read
        on_progress: Progress callback function

    Yields:
        Chunks of data
    """
    content_length = response.headers.get("content-length")
    total_size = int(content_length) if content_length else None

    progress = StreamProgress(total_size=total_size, on_progress=on_progress)

    try:
        async for chunk in response.aiter_bytes(chunk_size=chunk_size):
            if chunk:
                progress.update(len(chunk))
                yield chunk
    except Exception as e:
        logger.error(
            "Async stream download error",
            error=str(e),
            bytes_transferred=progress.bytes_transferred,
        )
        raise


def stream_upload(
    file_obj: BinaryIO,
    chunk_size: int = 8192,
    on_progress: Optional[Callable[[int, Optional[int]], None]] = None,
) -> Iterator[bytes]:
    """
    Stream upload from file object.

    Args:
        file_obj: File object to read from
        chunk_size: Size of chunks to read
        on_progress: Progress callback function

    Yields:
        Chunks of data
    """
    # Get file size for progress tracking
    file_obj.seek(0, 2)  # Seek to end
    total_size = file_obj.tell()
    file_obj.seek(0)  # Seek back to start

    progress = StreamProgress(total_size=total_size, on_progress=on_progress)

    try:
        while True:
            chunk = file_obj.read(chunk_size)
            if not chunk:
                break
            progress.update(len(chunk))
            yield chunk
    except Exception as e:
        logger.error(
            "Stream upload error",
            error=str(e),
            bytes_transferred=progress.bytes_transferred,
        )
        raise
    finally:
        file_obj.seek(0)  # Reset file position


async def async_stream_upload(
    file_data: Union[bytes, str],
    chunk_size: int = 8192,
    on_progress: Optional[Callable[[int, Optional[int]], None]] = None,
) -> AsyncIterator[bytes]:
    """
    Async stream upload from data.

    Args:
        file_data: Data to upload
        chunk_size: Size of chunks to yield
        on_progress: Progress callback function

    Yields:
        Chunks of data
    """
    if isinstance(file_data, str):
        file_data = file_data.encode()

    total_size = len(file_data)
    progress = StreamProgress(total_size=total_size, on_progress=on_progress)

    try:
        for i in range(0, total_size, chunk_size):
            chunk = file_data[i : i + chunk_size]
            progress.update(len(chunk))
            yield chunk

            # Allow other coroutines to run
            await asyncio.sleep(0)
    except Exception as e:
        logger.error(
            "Async stream upload error",
            error=str(e),
            bytes_transferred=progress.bytes_transferred,
        )
        raise


class StreamBuffer:
    """
    Buffer for streaming data with backpressure control.
    """

    def __init__(
        self,
        max_size: int = 1024 * 1024,  # 1MB default
        on_buffer_full: Optional[Callable[[], None]] = None,
    ):
        self.max_size = max_size
        self.buffer = bytearray()
        self.on_buffer_full = on_buffer_full
        self._closed = False

    def write(self, data: bytes) -> None:
        """Write data to buffer."""
        if self._closed:
            raise ValueError("Buffer is closed")

        self.buffer.extend(data)

        # Check buffer size
        if len(self.buffer) > self.max_size:
            if self.on_buffer_full:
                self.on_buffer_full()
            # Optionally, could raise an exception here

    def read(self, size: int = -1) -> bytes:
        """Read data from buffer."""
        if size < 0:
            data = bytes(self.buffer)
            self.buffer.clear()
        else:
            data = bytes(self.buffer[:size])
            del self.buffer[:size]
        return data

    def peek(self, size: int = -1) -> bytes:
        """Peek at data without removing it."""
        if size < 0:
            return bytes(self.buffer)
        return bytes(self.buffer[:size])

    def close(self) -> None:
        """Close the buffer."""
        self._closed = True

    def __len__(self) -> int:
        """Get buffer size."""
        return len(self.buffer)


async def async_stream_with_buffer(
    source: AsyncIterator[bytes],
    buffer_size: int = 1024 * 1024,
    on_buffer_full: Optional[Callable[[], None]] = None,
) -> AsyncIterator[bytes]:
    """
    Stream data with buffering for backpressure control.

    Args:
        source: Async iterator of data chunks
        buffer_size: Maximum buffer size
        on_buffer_full: Callback when buffer is full

    Yields:
        Buffered data chunks
    """
    buffer = StreamBuffer(max_size=buffer_size, on_buffer_full=on_buffer_full)

    async def producer():
        """Produce task to read from source."""
        try:
            async for chunk in source:
                buffer.write(chunk)
        except Exception as e:
            logger.error("Stream producer error", error=str(e))
        finally:
            buffer.close()

    # Start producer task
    producer_task = asyncio.create_task(producer())

    try:
        # Consume from buffer
        while not buffer._closed or len(buffer) > 0:
            if len(buffer) > 0:
                yield buffer.read()
            else:
                # Wait for more data
                await asyncio.sleep(0.01)
    finally:
        # Ensure producer task is complete
        await producer_task
