import React from 'react'

function Error({ statusCode }: { statusCode: number }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
            <h1 className="text-4xl font-bold mb-4">
                {statusCode
                    ? `An error ${statusCode} occurred on server`
                    : 'An error occurred on client'}
            </h1>
            <p className="text-gray-400">Please try again later.</p>
        </div>
    )
}

Error.getInitialProps = ({ res, err }: any) => {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404
    return { statusCode }
}

export default Error
