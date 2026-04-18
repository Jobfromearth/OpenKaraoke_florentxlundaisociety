import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '../SearchBar'
import type { YouTubeSearchResult } from '@/lib/types'

const mockResults: YouTubeSearchResult[] = [
  { videoId: 'abc123', title: 'Hello - Adele', channelTitle: 'Adele', thumbnailUrl: '', durationSeconds: 295 },
]

describe('SearchBar', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders search input', () => {
    render(<SearchBar onSelect={jest.fn()} language="en" />)
    expect(screen.getByPlaceholderText(/搜索歌曲/)).toBeInTheDocument()
  })

  it('shows results after search', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    }) as jest.Mock

    render(<SearchBar onSelect={jest.fn()} language="en" />)
    await userEvent.type(screen.getByPlaceholderText(/搜索歌曲/), 'Hello')
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => {
      expect(screen.getByText('Hello - Adele')).toBeInTheDocument()
    })
  })

  it('calls onSelect with result when clicked', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    }) as jest.Mock

    const onSelect = jest.fn()
    render(<SearchBar onSelect={onSelect} language="en" />)
    await userEvent.type(screen.getByPlaceholderText(/搜索歌曲/), 'Hello')
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => screen.getByText('Hello - Adele'))
    fireEvent.click(screen.getByRole('button', { name: /Hello - Adele/ }))
    expect(onSelect).toHaveBeenCalledWith({ ...mockResults[0], language: 'en' })
  })
})
