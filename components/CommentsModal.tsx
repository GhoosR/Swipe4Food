import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Send, MessageCircle, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';
import { useRouter } from 'expo-router';
import UserBadge from './UserBadge';

interface CommentsModalProps {
  visible: boolean;
  video: any;
  onClose: () => void;
  onCommentsUpdate: () => void;
}

export default function CommentsModal({ visible, video, onClose, onCommentsUpdate }: CommentsModalProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [commenterBadges, setCommenterBadges] = useState<Record<string, any>>({});
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (visible && video) {
      loadComments();
    }
  }, [visible, video]);

  const loadComments = async () => {
    if (!video) return;
    
    try {
      const videoComments = await api.getComments(video.id);
      setComments(videoComments);
      await loadCommenterBadges(videoComments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const loadCommenterBadges = async (comments: any[]) => {
    try {
      const uniqueUserIds = [...new Set(comments.map(c => c.user_id))];
      const badges: Record<string, any> = {};
      
      for (const userId of uniqueUserIds) {
        try {
          const userBadge = await api.getUserHighestBadge(userId);
          if (userBadge) {
            badges[userId] = userBadge;
          }
        } catch (error) {
          console.error('Failed to load badge for user:', userId);
        }
      }
      
      setCommenterBadges(badges);
    } catch (error) {
      console.error('Failed to load commenter badges:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadComments();
      onCommentsUpdate();
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddComment = async (text: string, parentId?: string) => {
    if (!user || !video || !text.trim() || loading) return;
    
    setLoading(true);
    
    try {
      await api.addComment(video.id, text.trim(), parentId);
      
      if (parentId) {
        setReplyingTo(null);
        setReplyText('');
      } else {
        setNewComment('');
      }
      
      await loadComments();
      onCommentsUpdate();
      await api.trackVideoEvent(video.id, 'comment');
    } catch (error) {
      console.error('Failed to add comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserProfileNavigation = (userId: string) => {
    if (!userId) return;
    onClose();
    setTimeout(() => {
      router.push(`/user/${userId}`);
    }, 300);
  };

  const handleReply = (commentId: string, userName: string) => {
    setReplyingTo(commentId);
    setReplyText(`@${userName} `);
  };

  const renderComment = (comment: any, depth: number = 0) => {
    return (
      <View key={comment.id} style={[
        styles.commentItem,
        { marginLeft: depth * 20 }
      ]}>
        <TouchableOpacity 
          onPress={() => handleUserProfileNavigation(comment.user_id)}
          activeOpacity={0.7}
        >
          <Image 
            source={{ uri: comment.profiles?.avatar_url || 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg' }} 
            style={styles.commentAvatar} 
          />
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <TouchableOpacity 
            onPress={() => handleUserProfileNavigation(comment.user_id)}
            activeOpacity={0.7}
            style={styles.userHeader}
          >
            <Text style={styles.commentUser}>
              {comment.profiles?.name || 'Anonymous'}
            </Text>
            {commenterBadges[comment.user_id] && (
              <UserBadge 
                badgeName={commenterBadges[comment.user_id].badge_name}
                badgeIcon={commenterBadges[comment.user_id].badge_icon}
                badgeColor={commenterBadges[comment.user_id].badge_color}
                size="small"
                showLabel={false}
              />
            )}
          </TouchableOpacity>
          
          <Text style={styles.commentText}>{comment.text}</Text>
          
          <View style={styles.commentMeta}>
            <Text style={styles.commentTime}>
              {new Date(comment.created_at).toLocaleDateString()}
            </Text>
            
            {user && depth < 3 && (
              <TouchableOpacity 
                onPress={() => handleReply(comment.id, comment.profiles?.name || 'User')}
                style={styles.replyButton}
              >
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {replyingTo === comment.id && (
            <View style={styles.replyInputContainer}>
              <TextInput
                style={styles.replyTextInput}
                placeholder={`Reply to ${comment.profiles?.name || 'User'}...`}
                placeholderTextColor="#94A3B8"
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={500}
                autoFocus
              />
              <View style={styles.replyActions}>
                <TouchableOpacity 
                  style={styles.cancelReplyButton}
                  onPress={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                >
                  <Text style={styles.cancelReplyText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sendReplyButton, 
                    { opacity: replyText.trim() && !loading ? 1 : 0.5 }
                  ]} 
                  onPress={() => handleAddComment(replyText, comment.id)}
                  disabled={!replyText.trim() || loading}
                >
                  <Send size={16} color="white" />
                  <Text style={styles.sendReplyText}>Reply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {comment.replies.map((reply: any) => renderComment(reply, depth + 1))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderCommentItem = ({ item }: { item: any }) => renderComment(item, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.title}>Comments</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw 
              size={20} 
              color="#4A5568" 
              style={refreshing ? styles.rotatingRefresh : undefined} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          {comments.length > 0 ? (
            <FlatList
              data={comments}
              renderItem={renderCommentItem}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          ) : (
            <View style={styles.emptyComments}>
              <MessageCircle size={64} color="#D1D5DB" />
              <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtitle}>Be the first to share your thoughts!</Text>
            </View>
          )}
        </View>
        
        {user && (
          <View style={styles.commentInputContainer}>
            <View style={styles.commentInput}>
              <Image 
                source={{ uri: user?.avatar_url || 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg' }} 
                style={styles.commentInputAvatar} 
              />
              <TextInput
                style={styles.commentTextInput}
                placeholder="Share your thoughts..."
                placeholderTextColor="#94A3B8"
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton, 
                  { 
                    backgroundColor: newComment.trim() && !loading ? '#f29056' : '#F3F4F6',
                  }
                ]} 
                onPress={() => handleAddComment(newComment)}
                disabled={!newComment.trim() || loading}
              >
                <Send size={18} color={newComment.trim() && !loading ? 'white' : '#94A3B8'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  refreshButton: {
    padding: 4,
  },
  rotatingRefresh: {
    transform: [{ rotate: '45deg' }],
  },
  content: {
    flex: 1,
    backgroundColor: 'white',
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentContent: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
  },
  commentText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 6,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  commentTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
  },
  replyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  replyButtonText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#f29056',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyInputContainer: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  replyTextInput: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    minHeight: 40,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelReplyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  cancelReplyText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  sendReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f29056',
    gap: 4,
  },
  sendReplyText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  emptyComments: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyCommentsTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 24,
    marginBottom: 12,
  },
  emptyCommentsSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  commentInputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentInputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    maxHeight: 120,
    paddingVertical: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});